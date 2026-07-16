# ============================================================
#  IPA Compilor — Docker macOS Build Environment
#  Experimental: docker-osx for headless Xcode builds
# ============================================================

FROM sickcodes/docker-osx:ventura

# Labels
LABEL maintainer="IPA Compilor Platform"
LABEL description="macOS Ventura build agent for iOS .ipa compilation"
LABEL version="2.0.0"

# Environment
ENV DEBIAN_FRONTEND=noninteractive
ENV IPA_REMOTE=1
ENV HOMEBREW_NO_AUTO_UPDATE=1
ENV HOMEBREW_NO_INSTALL_CLEANUP=1

# Install Homebrew toolchain (runs inside macOS layer)
RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>/dev/null || true
RUN brew install swiftlint swiftformat xcbeautify fastlane || true

# Install Xcode command-line tools
RUN xcode-select --install 2>/dev/null || true

# Install Ruby + Fastlane
RUN gem install fastlane --no-document 2>/dev/null || true

# Workspace
WORKDIR /ipa-compilor
RUN mkdir -p artifacts/ipa artifacts/archives artifacts/logs config

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose VNC (for debugging)
EXPOSE 5900

# SSH
EXPOSE 22

ENTRYPOINT ["/entrypoint.sh"]
CMD ["build"]
