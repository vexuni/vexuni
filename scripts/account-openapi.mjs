const object = (properties, required = []) => ({
    type: "object",
    properties,
    required,
  }),
  str = (maxLength = 128) => ({ type: "string", maxLength });
const proof = object({ password: str(), otp: str(64) }, ["password", "otp"]);
export function addAccountPaths(paths) {
  const routes = [
    [
      "get",
      "/api/account/security",
      "account_security",
      null,
      "Read authenticator status and remaining recovery-code count.",
    ],
    [
      "post",
      "/api/account/mfa/setup",
      "setup_authenticator",
      object({ password: str() }, ["password"]),
      "Verify current password and return a ten-minute enrollment secret and otpauth URI. Never log the response.",
    ],
    [
      "post",
      "/api/account/mfa/enable",
      "enable_authenticator",
      object(
        {
          version: { type: "string", format: "uuid" },
          otp: { type: "string", pattern: "^[0-9]{6}$" },
        },
        ["version", "otp"],
      ),
      "Confirm possession. Returns ten recovery codes once and revokes other browser sessions.",
    ],
    [
      "post",
      "/api/account/mfa/recovery",
      "rotate_recovery_codes",
      proof,
      "Verify password and fresh factor, invalidate old recovery codes, return ten new codes once.",
    ],
    [
      "post",
      "/api/account/mfa/disable",
      "disable_authenticator",
      proof,
      "Verify password and fresh factor, disable MFA and revoke other browser sessions.",
    ],
    [
      "get",
      "/api/account/sessions",
      "list_sessions",
      null,
      "List up to 100 active browser sessions, without credential hashes.",
    ],
    [
      "delete",
      "/api/account/sessions/{id}",
      "revoke_session",
      null,
      "Revoke one session owned by the current user.",
    ],
    [
      "get",
      "/api/profile",
      "read_own_profile",
      null,
      "Read editable public profile fields.",
    ],
    [
      "put",
      "/api/profile",
      "update_profile",
      object({
        display_name: str(80),
        bio: str(2000),
        location: str(100),
        website: str(1000),
      }),
      "Replace public profile fields. Website must use HTTP(S), without embedded credentials.",
    ],
    [
      "get",
      "/api/profiles/{username}",
      "public_profile",
      null,
      "Read public profile and up to 50 repositories/activity entries visible to the viewer. Disabled users return 404.",
    ],
    [
      "get",
      "/api/repos/{namespace}/{repo}/preview",
      "preview_image",
      null,
      "Read a Git blob as PNG, JPEG, GIF or WebP using byte signatures. Requires repository read access; private no-store, 5 MiB maximum.",
    ],
    [
      "post",
      "/api/webauthn/register/options",
      "passkey_register_options",
      null,
      "Begin public registration with a WebAuthn creation ceremony. The passkey is created first; the username is chosen in the second step.",
    ],
    [
      "post",
      "/api/webauthn/register/verify",
      "passkey_register_verify",
      object(
        {
          username: str(48),
          response: object({
            clientDataJSON: str(8192),
            attestationObject: str(65536),
            transports: { type: "array", items: str(32) },
          }),
        },
        ["username", "response"],
      ),
      "Verify the attestation, create the account bound to the passkey and issue a browser session. Challenges are single-use, ten-minute expiry.",
    ],
    [
      "post",
      "/api/webauthn/login/options",
      "passkey_login_options",
      object({ username: str(48) }),
      "Begin a passkey sign-in. Without a username the browser offers discoverable credentials for this site.",
    ],
    [
      "post",
      "/api/webauthn/login/verify",
      "passkey_login_verify",
      object(
        {
          credential: object({
            id: str(2048),
            response: object({
              clientDataJSON: str(8192),
              authenticatorData: str(8192),
              signature: str(16384),
              userHandle: str(2048),
            }),
          }),
        },
        ["credential"],
      ),
      "Verify the assertion signature against the stored credential and issue a browser session.",
    ],
    [
      "get",
      "/api/webauthn/credentials",
      "passkey_list",
      null,
      "List passkeys on the signed-in account.",
    ],
    [
      "post",
      "/api/webauthn/manage/options",
      "passkey_manage_options",
      null,
      "Begin a ceremony to add another passkey to the signed-in account; existing credentials are excluded.",
    ],
    [
      "post",
      "/api/webauthn/manage/verify",
      "passkey_manage_verify",
      object(
        {
          name: str(60),
          response: object({
            clientDataJSON: str(8192),
            attestationObject: str(65536),
            transports: { type: "array", items: str(32) },
          }),
        },
        ["response"],
      ),
      "Verify the attestation and attach the new passkey to the signed-in account (maximum 10).",
    ],
    [
      "patch",
      "/api/webauthn/credentials/{id}",
      "passkey_rename",
      object({ name: str(60) }, ["name"]),
      "Rename a passkey owned by the signed-in account.",
    ],
    [
      "delete",
      "/api/webauthn/credentials/{id}",
      "passkey_delete",
      null,
      "Delete a passkey owned by the signed-in account. The last passkey cannot be removed while it is the only sign-in method.",
    ],
  ];
  for (const [method, path, id, schema, description] of routes) {
    const publicProfile = id === "public_profile",
      image = id === "preview_image";
    const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      schema: str(),
    }));
    if (publicProfile)
      parameters.push({
        name: "before",
        in: "query",
        schema: { type: "integer", minimum: 1 },
      });
    if (image)
      for (const name of ["ref", "path"])
        parameters.push({
          name,
          in: "query",
          required: name === "path",
          schema: str(1000),
        });
    (paths[path] ||= {})[method] = {
      operationId: id,
      summary: id.replaceAll("_", " "),
      description:
        description +
        " See docs/ACCOUNT-v06.md. Cookie-authenticated mutations require a same-origin Origin header.",
      tags: [image ? "Repository" : "Account"],
      parameters,
      security: publicProfile
        ? [{}, { sessionCookie: [] }]
        : image
          ? [{ sessionCookie: [] }, { bearerAuth: [] }]
          : [{ sessionCookie: [] }],
      ...(schema
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema } },
            },
          }
        : {}),
      responses: {
        200: { description: "Success" },
        400: { description: "Invalid input" },
        401: { description: "Sign in required" },
        403: { description: "Session, role or verification required" },
        404: { description: "Not found" },
        409: { description: "Concurrent account change or expired setup" },
        429: { description: "Verification rate limit" },
      },
    };
  }
}
