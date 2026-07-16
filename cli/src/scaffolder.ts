import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import chalk from "chalk";
import { Logger } from "./logger.js";
import { ConfigManager } from "./config.js";

const c = {
  cyan: chalk.hex("#00D4FF"),
  purple: chalk.hex("#7B2FFF"),
  green: chalk.hex("#00FF88"),
  gray: chalk.hex("#4A5568"),
  white: chalk.white,
};

export class ProjectScaffolder {
  private log = new Logger("SCAFFOLD");
  private cfg = new ConfigManager();

  async create(name: string, template: string): Promise<void> {
    this.log.banner("Project Scaffolder", `${name} · ${template}`);
    this.log.resetStep();

    const projectRoot = join(process.cwd(), name);
    this.log.data("Project name", name);
    this.log.data("Template", template);
    this.log.data("Output", projectRoot);
    console.log();

    const steps = [
      ["Creating project structure", () => this.createStructure(projectRoot, name)],
      ["Writing Package.swift", () => this.writePackageSwift(projectRoot, name)],
      ["Scaffolding Swift sources", () => this.writeSwiftSources(projectRoot, name)],
      ["Writing Xcode project", () => this.writeXcodeProject(projectRoot, name)],
      ["Creating test targets", () => this.writeTests(projectRoot, name)],
      ["Writing resource assets", () => this.writeResources(projectRoot, name)],
      ["Generating .gitignore", () => this.writeGitignore(projectRoot)],
      ["Configuring GitHub Pipeline", () => this.writeWorkflow(projectRoot)],
    ] as Array<[string, () => void]>;

    for (const [label, fn] of steps) {
      this.log.step(label + "...");
      fn();
      await sleep(100);
      this.log.success(label);
    }

    console.log();
    this.log.separator("PROJECT READY");
    console.log(`\n  ${c.cyan("Next steps:")}\n`);
    console.log(`  ${c.purple("1.")} ${c.white("ipa-compilor config --team-id <YOUR_TEAM_ID>")}`);
    console.log(`  ${c.purple("2.")} ${c.white("ipa-compilor build --remote")}`);
    console.log(`  ${c.purple("3.")} ${c.white("ipa-compilor sign")}\n`);
  }

  private createStructure(root: string, name: string): void {
    const dirs = [
      `${name}.xcodeproj`,
      `${name}/Preview Content`,
      `${name}/Assets.xcassets/AppIcon.appiconset`,
      `${name}/Assets.xcassets/AccentColor.colorset`,
      `.github/workflows`,
    ];
    for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });
  }

  private writePackageSwift(root: string, name: string): void {
    const content = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${name}",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "${name}", targets: ["${name}"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "${name}",
            dependencies: [],
            path: "Sources/${name}",
            resources: [.process("../../Resources")]
        ),
        .testTarget(
            name: "${name}Tests",
            dependencies: ["${name}"],
            path: "Tests/${name}Tests"
        ),
    ]
)
`;
    writeFileSync(join(root, "Package.swift"), content);
  }

  private writeSwiftSources(root: string, name: string): void {
    // App.swift
    writeFileSync(join(root, `${name}/App.swift`), `import SwiftUI

@main
struct ${name}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`);

    // ContentView.swift
    writeFileSync(join(root, `${name}/ContentView.swift`), `import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, ${name}!")
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
`);

    // Info.plist
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
	</dict>
	<key>UILaunchScreen</key>
	<dict/>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
</dict>
</plist>
`;
    writeFileSync(join(root, `${name}/Info.plist`), plistContent);
  }

  private writeTests(root: string, name: string): void {
    writeFileSync(join(root, `Tests/${name}Tests/${name}Tests.swift`), `import XCTest
@testable import ${name}

final class ${name}Tests: XCTestCase {
    var appState: AppState!

    @MainActor
    override func setUp() async throws {
        appState = AppState()
    }

    @MainActor
    func testInitialFeatureCount() {
        XCTAssertEqual(appState.features.count, 4)
    }

    @MainActor
    func testInitialLoadingState() {
        XCTAssertFalse(appState.isLoading)
    }

    func testAPIClientSingleton() async {
        let a = APIClient.shared
        let b = APIClient.shared
        XCTAssertTrue(a === b)
    }

    func testFeatureIDs() {
        let features = Feature.defaults
        let ids = Set(features.map(\\.id))
        XCTAssertEqual(ids.count, features.count, "All features should have unique IDs")
    }
}
`);
  }

  private writeXcodeProject(root: string, name: string): void {
    const pbxproj = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {
		111111111111111111111111 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
				TargetAttributes = {
					222222222222222222222222 = {
						CreatedOnToolsVersion = 15.0;
					};
				};
			};
			buildConfigurationList = 333333333333333333333333 /* Build configuration list for PBXProject "${name}" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = 444444444444444444444444 /* ${name} */;
			productRefGroup = 555555555555555555555555 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				222222222222222222222222 /* ${name} */,
			);
		};
		222222222222222222222222 /* ${name} */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 666666666666666666666666 /* Build configuration list for PBXNativeTarget "${name}" */;
			buildPhases = (
				777777777777777777777777 /* Sources */,
				888888888888888888888888 /* Frameworks */,
				999999999999999999999999 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = ${name};
			productName = ${name};
			productReference = AAAAAAAAAAAAAAAAAAAAAAAA /* ${name}.app */;
			productType = "com.apple.product-type.application";
		};
		333333333333333333333333 /* Build configuration list for PBXProject "${name}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				BBBBBBBBBBBBBBBBBBBBBBBB /* Debug */,
				CCCCCCCCCCCCCCCCCCCCCCCC /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		666666666666666666666666 /* Build configuration list for PBXNativeTarget "${name}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				DDDDDDDDDDDDDDDDDDDDDDDD /* Debug */,
				EEEEEEEEEEEEEEEEEEEEEEEE /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		BBBBBBBBBBBBBBBBBBBBBBBB /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				SDKROOT = iphoneos;
				SWIFT_VERSION = 5.0;
			};
			name = Debug;
		};
		CCCCCCCCCCCCCCCCCCCCCCCC /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				SDKROOT = iphoneos;
				SWIFT_VERSION = 5.0;
			};
			name = Release;
		};
		DDDDDDDDDDDDDDDDDDDDDDDD /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				INFOPLIST_FILE = "${name}/Info.plist";
				PRODUCT_BUNDLE_IDENTIFIER = "com.example.${name}";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 5.0;
			};
			name = Debug;
		};
		EEEEEEEEEEEEEEEEEEEEEEEE /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				INFOPLIST_FILE = "${name}/Info.plist";
				PRODUCT_BUNDLE_IDENTIFIER = "com.example.${name}";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 5.0;
			};
			name = Release;
		};
		444444444444444444444444 /* ${name} */ = {
			isa = PBXGroup;
			children = (
				FFFFFFFFFFFFFFFFFFFFFFFF /* ${name} */,
				555555555555555555555555 /* Products */,
			);
			sourceTree = "<group>";
		};
		555555555555555555555555 /* Products */ = {
			isa = PBXGroup;
			children = (
				AAAAAAAAAAAAAAAAAAAAAAAA /* ${name}.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
		FFFFFFFFFFFFFFFFFFFFFFFF /* ${name} */ = {
			isa = PBXGroup;
			children = (
				000000000000000000000001 /* App.swift */,
				000000000000000000000002 /* ContentView.swift */,
				000000000000000000000003 /* Info.plist */,
				000000000000000000000004 /* Assets.xcassets */,
				000000000000000000000005 /* Preview Content */,
			);
			path = ${name};
			sourceTree = "<group>";
		};
		777777777777777777777777 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				000000000000000000000006 /* App.swift in Sources */,
				000000000000000000000007 /* ContentView.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		888888888888888888888888 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		999999999999999999999999 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				000000000000000000000008 /* Assets.xcassets in Resources */,
				000000000000000000000009 /* Preview Content in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		000000000000000000000001 /* App.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = App.swift; sourceTree = "<group>"; };
		000000000000000000000002 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
		000000000000000000000003 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
		000000000000000000000004 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
		000000000000000000000005 /* Preview Content */ = {isa = PBXFileReference; lastKnownFileType = folder; path = "Preview Content"; sourceTree = "<group>"; };
		AAAAAAAAAAAAAAAAAAAAAAAA /* ${name}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${name}.app; sourceTree = BUILT_PRODUCTS_DIR; };
		000000000000000000000006 /* App.swift in Sources */ = {isa = PBXBuildFile; fileRef = 000000000000000000000001 /* App.swift */; };
		000000000000000000000007 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 000000000000000000000002 /* ContentView.swift */; };
		000000000000000000000008 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 000000000000000000000004 /* Assets.xcassets */; };
		000000000000000000000009 /* Preview Content in Resources */ = {isa = PBXBuildFile; fileRef = 000000000000000000000005 /* Preview Content */; };
	};
	rootObject = 111111111111111111111111 /* Project object */;
}
`;
    writeFileSync(join(root, `${name}.xcodeproj/project.pbxproj`), pbxproj);
  }

  private writeResources(root: string, name: string): void {
    writeFileSync(join(root, `${name}/Assets.xcassets/Contents.json`), JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2));
    writeFileSync(join(root, `${name}/Assets.xcassets/AppIcon.appiconset/Contents.json`), JSON.stringify({
      images: [
        { idiom: "iphone", scale: "2x", size: "20x20" },
        { idiom: "iphone", scale: "3x", size: "20x20" },
        { idiom: "iphone", scale: "2x", size: "60x60" },
        { idiom: "iphone", scale: "3x", size: "60x60" },
        { idiom: "ios-marketing", scale: "1x", size: "1024x1024" },
      ],
      info: { author: "xcode", version: 1 },
    }, null, 2));
    writeFileSync(join(root, `${name}/Assets.xcassets/AccentColor.colorset/Contents.json`), JSON.stringify({
      colors: [{ idiom: "universal", color: { "color-space": "display-p3", components: { red: "0.000", green: "0.831", blue: "1.000", alpha: "1.000" } } }],
      info: { author: "xcode", version: 1 },
    }, null, 2));
    writeFileSync(join(root, `${name}/Preview Content/Preview Assets.xcassets`), ""); // Mock folder file to keep it
  }

  private writeGitignore(root: string): void {
    writeFileSync(join(root, ".gitignore"), `# Xcode
*.xcuserdata
*.xcworkspace/xcuserdata/
DerivedData/
build/
*.ipa
*.dSYM.zip
*.dSYM

# Swift Package Manager
.build/
.swiftpm/

# macOS
.DS_Store
*.swp
`);
  }

  private writeWorkflow(root: string): void {
    const workflow = `name: iOS Build Pipeline

on:
  workflow_dispatch:

jobs:
  build:
    name: Build IPA
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Project
        run: |
          WORKSPACE_FILE=$(find . -maxdepth 2 -name "*.xcworkspace" -type d | head -n 1)
          PROJECT_FILE=$(find . -maxdepth 2 -name "*.xcodeproj" -type d | head -n 1)
          
          if [ -n "$WORKSPACE_FILE" ]; then
            TARGET_FILE="$WORKSPACE_FILE"
            TARGET_ARG="-workspace"
            SCHEME_NAME=$(basename "$WORKSPACE_FILE" .xcworkspace)
          elif [ -n "$PROJECT_FILE" ]; then
            TARGET_FILE="$PROJECT_FILE"
            TARGET_ARG="-project"
            SCHEME_NAME=$(basename "$PROJECT_FILE" .xcodeproj)
          else
            echo "Error: No .xcodeproj or .xcworkspace found."
            exit 1
          fi
          
          echo "Building $SCHEME_NAME from $TARGET_FILE..."
          
          xcodebuild $TARGET_ARG "$TARGET_FILE" \\
            -scheme "$SCHEME_NAME" \\
            -configuration Release \\
            -sdk iphoneos \\
            -destination 'generic/platform=iOS' \\
            build \\
            CONFIGURATION_BUILD_DIR="$(pwd)/build/Release-iphoneos" \\
            CODE_SIGNING_ALLOWED=NO \\
            CODE_SIGNING_REQUIRED=NO \\
            AD_HOC_CODE_SIGNING_ALLOWED=YES

      - name: Export IPA
        run: |
          mkdir -p build/Payload
          # Find the compiled .app bundle
          APP_PATH=$(find build -name "*.app" -type d | head -n 1)
          if [ -z "$APP_PATH" ]; then
            # Fallback for different build layouts
            APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "*.app" -type d | head -n 1)
          fi
          
          echo "Found App at: $APP_PATH"
          if [ -z "$APP_PATH" ]; then
            echo "Error: no .app bundle was produced."
            exit 1
          fi
          cp -R "$APP_PATH" build/Payload/
          cd build && zip -r ../Project-Unsigned.ipa Payload

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: Project-Real-Unsigned
          path: Project-Unsigned.ipa
`;
    writeFileSync(join(root, ".github/workflows/ipa-pipeline.yml"), workflow);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
