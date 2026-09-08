# Research: does keyring-rs (apple-native) support a custom/non-default Keychain file on macOS?

Research for #99, part of the isolate-API-key-storage wayfinder map (#98). Question: can Voicecraft
move its Keychain-backed API key storage off the shared `login.keychain` and into an app-owned
keychain file, and what would that take?

Current implementation for reference: `packages/app/src-tauri/src/commands/secrets.rs` (per-vendor
Keychain accounts under service `com.voicecraft.app`, via `keyring::Entry::new(service,
account)` / `.get_password()` / `.set_password()`), `keyring = { version = "3", features =
["apple-native"] }` in `packages/app/src-tauri/Cargo.toml`. The installed version is
`keyring 3.6.3`, backed by `security-framework 3.7.0` (per `Cargo.lock`).

## 1. Does keyring-rs (v3, `apple-native`) support targeting a custom keychain file?

**No.** Checked the exact source in use (`~/.cargo/registry/.../keyring-3.6.3/src/macos.rs`, same
file as [`open-source-cooperative/keyring-rs` on GitHub](https://github.com/hwchen/keyring-rs),
which redirected to `open-source-cooperative/keyring-rs`).

The module's own doc comment is explicit about the scope of what "target" means:

> "The OS automatically creates three of them (or four if removable media is being used), called
> _User_ (aka login), _Common_, _System_, and _Dynamic_. The target attribute of an `Entry`
> determines (case-insensitive) which keychain that entry's credential is created in or searched
> for. If the entry has no target, or the specified target doesn't name (case-insensitive) one of
> the four built-in keychains, the 'User' keychain is used."
> — `keyring-3.6.3/src/macos.rs` lines 5-11

Mechanically, `MacKeychainDomain::from_str` (macos.rs:218-238) only accepts the strings `"user"`,
`"system"`, `"common"`, `"dynamic"` — anything else is an `Invalid` error, not a path. `get_keychain`
(macos.rs:240-251) resolves a `MacCredential` to a `SecKeychain` exclusively via
`SecKeychain::default_for_domain(domain)` — one of Apple's four *pre-defined* keychains — never via
`SecKeychain::open(path)`. There is no builder option, `Entry` constructor argument, or feature flag
in v3 that accepts a filesystem path or an arbitrary keychain name; the `target` string is
constrained to that 4-value enum. Same conclusion holds for the newer, restructured
`keyring-core`/`apple-native-keyring-store` split (crates.io, current as of researching this):
its docs describe choosing between the "keychain" (legacy, `SecKeychain`-based) and "protected"
(iOS-style `SecItem`/Data Protection) storage backends and configuring biometrics/iCloud sync, but
still surface no custom-keychain-file targeting option in feature flags or constructors ([crates.io: apple-native-keyring-store](https://crates.io/crates/apple-native-keyring-store),
[docs.rs: apple_native_keyring_store](https://docs.rs/apple-native-keyring-store)).

## 2. Lowest-friction way to get an app-owned isolated keychain from Rust

keyring-rs's `apple-native` backend is a thin wrapper directly over the `security-framework` crate
(`security_framework::os::macos::keychain::SecKeychain` /
`security_framework::os::macos::passwords::find_generic_password`) — confirmed by the `use`
statements at the top of `macos.rs`. That crate is already a transitive dependency
(`security-framework 3.7.0`, in `Cargo.lock`), so no new dependency is required.

`security-framework`'s `os::macos::keychain` module (source read locally at
`~/.cargo/registry/.../security-framework-3.7.0/src/os/macos/keychain.rs`; same file mirrored at
[docs.rs/security-framework/latest/security_framework/os/macos/keychain](https://docs.rs/security-framework/latest/security_framework/os/macos/keychain/)) exposes exactly the surface keyring-rs
doesn't:

- `SecKeychain::open<P: AsRef<Path>>(path) -> Result<Self>` — wraps `SecKeychainOpen`, opens/refs an
  existing keychain file at an arbitrary path.
- `CreateOptions::new().password(...).create(path) -> Result<SecKeychain>` — wraps `SecKeychainCreate`,
  creates a new keychain file at an arbitrary path, optionally with a supplied password.
- `SecKeychain::unlock(&mut self, password: Option<&str>) -> Result<()>` — wraps `SecKeychainUnlock`.
- `find_generic_password(Some(&[keychain]), service, account)` (already used by keyring-rs itself) —
  accepts a search list of specific `SecKeychain` instances, so it works unmodified against a
  custom-opened keychain.

So the lowest-friction path is: keep the existing `set_generic_password`/`find_generic_password`
call shape (same as keyring-rs uses internally, real Keychain Services API, no bespoke crypto), but
resolve the `SecKeychain` via `CreateOptions::create(path)` / `SecKeychain::open(path)` against an
app-owned `.keychain-db` file (e.g. under the app's Application Support directory) instead of via
`SecKeychain::default_for_domain(User)`. This is a small, self-contained module written directly
against `security-framework` (bypassing `keyring` for this one path), not a fork of keyring-rs and
not a drop to raw FFI.

## 3. Unlocking an app-owned keychain without prompting on every launch

Apple's `SecKeychainCreate` docs (fetched from the live Apple Developer Documentation JSON API,
`developer.apple.com/tutorials/data/documentation/security/seckeychaincreate(_:_:_:_:_:_:).json`)
confirm the mechanism: `password`/`passwordLength` are supplied at creation time; `promptUser`, if
`true`, shows a password dialog and makes the `password` argument ignored — so a fully
programmatic, no-UI creation requires `promptUser = false` and a real password value passed in
(an empty/all-null password was not confirmed safe or documented as a supported "passwordless"
mode by this doc — do not assume it, verify by testing before relying on it). Symmetrically,
`SecKeychainUnlock`'s docs (`.../seckeychainunlock(_:_:_:_:).json`) state: "If you pass \[a locked
keychain\], this function displays [an] Unlock Keychain dialog box if you have not provided [a]
password... If [the] specified keychain [is] currently unlocked, the Unlock Keychain dialog box is
not displayed" — i.e., supplying the password programmatically at unlock time avoids the OS dialog
entirely, matching `security-framework`'s `SecKeychain::unlock(Some(password))` signature above.

So: yes, a custom keychain needs its own password, and that password must be supplied
programmatically (not `None`/prompt) at both creation and unlock time to avoid a UI prompt on every
app launch. That leaves the open question the ticket flags: **where does that password live?**
Three options, with tradeoffs, deliberately not resolved here:

- **A single dedicated item in the shared `login.keychain`.** This is the standard pattern used by
  browsers/password managers that maintain their own secondary keychain (e.g. how some apps store
  a "master key" for a local encrypted store). It reintroduces exactly one touch-point on the shared
  keychain the isolation work is trying to get away from — but it's a single, small, stable item
  (created once, read-only-ish thereafter) rather than the current pattern of two live API-key
  entries being read/written on every generation, so if repeated dev-loop rebuilds against an
  unsigned/ad-hoc-signed binary is what degraded the shared keychain (per the ticket's background),
  the blast radius of one static bootstrap item is much smaller — but not zero.
- **Deterministically derived from a stable per-install source** (e.g. a value from the Secure
  Enclave / `kSecAttrAccessControl`-gated key, or a machine/user identifier run through a KDF).
  Avoids touching the shared keychain at all, but needs a genuinely stable, app-scoped secret
  source to derive from; using something weak or guessable (hostname, username) would undermine the
  "no plaintext-at-rest" guarantee this whole effort exists to preserve.
- **Store the keychain password in a plain file on disk, protected only by filesystem permissions.**
  Fastest to implement, but reintroduces a "custom encrypted-file format"-adjacent risk (a file with
  weak protection guarding the keychain) that the ticket's stated direction explicitly wants to
  avoid ("still using real macOS Keychain/Security-framework APIs... not a bespoke encrypted-file
  format... still guaranteeing no plaintext-at-rest").

No primary source resolves which of these is correct for Voicecraft's threat model — this is a
product/security tradeoff call, not a research question with a factual answer, and is flagged as an
open decision in the Recommendation below.

## 4. Does a custom keychain still trigger the "App wants to access keychain item X" ACL prompt?

**Yes — and it is not specific to the default/login keychain.** Apple's official "Access Control
Lists" documentation (fetched live,
`developer.apple.com/tutorials/data/documentation/security/access-control-lists.json`) describes
the mechanism generically, per keychain *item*, not per keychain *file*:

> "In macOS, [for] items not stored on iCloud keychain, each protected keychain item... has an
> associated access instance [that] contains an access control list (ACL). ...When [an] app
> attempts [to] access [a] keychain item for [a] particular purpose... the system looks [for an]
> entry in [the] item's ACL containing [that] operation... If there is an entry [and] the calling
> app is among the entry's trusted apps, the system grants access. Otherwise, the system prompts
> the user for confirmation. The user may choose to Deny, Allow, or Always Allow access [and]
> 'Always Allow' adds the app to the [item's trusted-app] list."
> — Apple Developer Documentation, "Access Control Lists"

This ACL/trust mechanism is a property of the individual keychain *item* (who created it, what
apps are in its trusted-app list, its code-signature/team-ID partition ID) — the documentation
draws no distinction between the default login keychain and any other keychain file; nothing in
`SecKeychainCreate`'s docs, `SecAccess`'s docs, or the ACL overview scopes this behavior to the
default keychain specifically. Corroborating community/DTS discussion on Apple's own Developer
Forums (non-authoritative but consistent, e.g.
[thread 106794](https://developer.apple.com/forums/thread/106794),
[thread 649081](https://developer.apple.com/forums/thread/649081)) confirms in practice: the
creating app is trusted by default for items it creates (matching Voicecraft's existing test
comment in `secrets.rs` — "Same-process reads of an entry this process just wrote don't trigger a
Keychain access prompt"), and prompts mainly arise for items an app didn't create, or when the
app's code-signing identity isn't stable across builds (debug vs. release Designated Requirements
differ) — a risk equally applicable to a custom keychain as to `login.keychain`, and arguably the
actual root cause of the degraded shared-keychain behavior described in this ticket's background
(repeated ad-hoc-signed rebuilds → unstable code identity → repeated re-prompting/re-trust churn
against items other apps also touch). Moving to an app-owned keychain does not, by itself, change
this code-signature-stability exposure; it isolates *which* items and *which* other apps are
affected by it, not whether it happens.

One relevant note found on the deprecation side: Apple's current `SecKeychainCreate` docs mark the
`initialAccess: SecAccess?` parameter as **"Ignored. Pass NULL for this parameter"** — i.e. the
legacy path for setting a *custom* initial ACL at keychain-creation time is itself deprecated/
inert on current macOS; item-level ACLs are set at *item* creation (`SecKeychainAddGenericPassword`
et al.), not at keychain-file creation, which is consistent with the "ACL is per-item, not
per-keychain-file" reading above.

## Sources

- `keyring-3.6.3/src/macos.rs` — local crate source, `~/.cargo/registry/src/index.crates.io-.../keyring-3.6.3/src/macos.rs` (mirrors [open-source-cooperative/keyring-rs](https://github.com/hwchen/keyring-rs) on GitHub)
- [crates.io: apple-native-keyring-store](https://crates.io/crates/apple-native-keyring-store)
- [docs.rs: apple_native_keyring_store](https://docs.rs/apple-native-keyring-store)
- `security-framework-3.7.0/src/os/macos/keychain.rs` — local crate source, `~/.cargo/registry/src/index.crates.io-.../security-framework-3.7.0/src/os/macos/keychain.rs`
- [docs.rs: security_framework::os::macos::keychain](https://docs.rs/security-framework/latest/security_framework/os/macos/keychain/)
- [Apple Developer Documentation: SecKeychainCreate(_:_:_:_:_:_:)](https://developer.apple.com/documentation/security/seckeychaincreate(_:_:_:_:_:_:)) (live JSON API fetch; deprecated as of macOS 10.10)
- [Apple Developer Documentation: SecKeychainUnlock(_:_:_:_:)](https://developer.apple.com/documentation/security/seckeychainunlock(_:_:_:_:))
- [Apple Developer Documentation: Access Control Lists](https://developer.apple.com/documentation/security/access-control-lists)
- [Apple Developer Documentation: SecAccess](https://developer.apple.com/documentation/security/secaccess)
- Apple Developer Forums (corroborating, non-authoritative): [thread 106794 — SecKeychainItemCopyAccess / DTS on setting ACLs at item creation time](https://developer.apple.com/forums/thread/106794), [thread 649081 — avoiding double keychain prompts](https://developer.apple.com/forums/thread/649081)
- `packages/app/src-tauri/src/commands/secrets.rs`, `packages/app/src-tauri/Cargo.toml`, `packages/app/src-tauri/Cargo.lock` (current implementation, for reference)

## Recommendation

Implement the app-owned keychain via **direct `security-framework` calls**, not keyring-rs: keyring
v3's `apple-native` backend has no API surface for a custom keychain file (§1), while
`security-framework` — already a transitive dependency and the exact library keyring-rs itself
wraps — exposes `CreateOptions::create(path)` / `SecKeychain::open(path)` / `unlock(password)` plus
the same `find_generic_password`/`set_generic_password` calls keyring-rs already uses (§2). This is
a small, self-contained module, not a fork or raw FFI, and keeps the "real Keychain/Security
framework, no bespoke encrypted-file format" constraint intact.

**Open risk requiring a human decision, not resolved by this research:** where the custom
keychain's own unlocking password lives (§3). All three options investigated have a real tradeoff —
a single bootstrap item in `login.keychain` (smallest blast radius but not zero shared-keychain
touch), a KDF-derived password from a stable per-install secret (zero shared-keychain touch but
needs a genuinely strong, app-scoped derivation source to avoid a weaker "no plaintext-at-rest"
guarantee than what's being replaced), or a plain-file-permissions-protected secret (fastest but
reintroduces the bespoke-protected-file pattern the effort is meant to avoid). None is clearly
"correct" from documentation alone; this needs an explicit choice before implementation.

Also worth flagging: per §4, moving off `login.keychain` does not, on its own, eliminate ACL/trust
prompts or code-signature-stability churn — those are properties of the keychain *item* and the
app's code-signing identity, not of which keychain file holds the item. If the dev-loop rebuild
churn described in this ticket's background is driven by an unstable ad-hoc code signature (a
plausible read of the Apple Forums material), an app-owned keychain isolates the blast radius (only
Voicecraft's own items are affected, not other apps' Keychain state) but does not by itself remove
repeated re-prompting for Voicecraft's own keys across rebuilds — a stable signing identity (or
otherwise durable code-signature story for dev builds) is a separate, complementary fix worth
scoping alongside this one.

Context pointer: mellowrush/voicecraft issue #99
