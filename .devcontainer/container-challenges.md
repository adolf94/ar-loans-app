# Dev Container Challenges

Running log of issues encountered and their resolutions.

---

## Template

### Challenge: [Title]
**Date:** YYYY-MM-DD  
**Issue:** Description of the problem  
**Error:** Relevant error message (if any)  
**Resolution:** Steps taken to fix  
**Status:** Resolved / Open

---

## Challenges

<!-- Add entries below -->

### Challenge: opencode AI tool post-install failure
**Date:** 2026-09-05  
**Issue:** opencode required post-install steps that were failing during container setup  
**Error:** Post-install script errors when using npm installation  
**Resolution:** Updated setup.sh to use shell script version instead of npm installation  
**Status:** Resolved

### Challenge: Private package authentication tokens in dev container
**Date:** 2026-09-05  
**Issue:** Development environment requires authentication tokens (Azure DevOps PAT, GitHub tokens) to access private npm packages and repositories. These tokens need to be available as environment variables for package managers and build tools, but must persist across container rebuilds and be available in every new terminal session without being committed to source control.  
**Challenge Details:** 
- Tokens must be injected into the container at runtime, not baked into the image
- New terminal sessions (consoles) don't inherit environment variables from the container build process
- Developers need a simple way to configure their tokens without modifying shared configuration files
- Tokens must be excluded from git to prevent accidental commits
**Resolution:** Created `.devcontainer/.env` file (excluded via .gitignore) to store token variables. Added script in setup.sh that sources this .env file on every new console session, ensuring tokens are always available when developers open new terminals.  
**Status:** Resolved
