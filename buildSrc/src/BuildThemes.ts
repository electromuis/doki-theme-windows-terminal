import {
  BaseAppDokiThemeDefinition,
  constructNamedColorTemplate,
  DokiThemeDefinitions,
  evaluateTemplates,
  MasterDokiThemeDefinition,
  resolvePaths,
  StringDictionary,
  dictionaryReducer,
  resolveNamedColors,
  applyNamedColors,
  composeTemplate,
  NAMED_COLOR_TYPE,
  walkDir,
  readJson
} from "doki-build-source";
import path from 'path';
import fs from "fs";

const glob = require("glob");

const {
  repoDirectory,
  masterThemeDefinitionDirectoryPath,
  appDefinitionDirectoryPath,
  appTemplatesDirectoryPath
} = resolvePaths(__dirname);

type WindowsTerminalDokiThemeDefinition = BaseAppDokiThemeDefinition;

type WindowsTerminalDokiTheme = {
  path: string;
  definition: MasterDokiThemeDefinition;
  theme: any;
};

const swapMasterThemeForLocalTheme = (
  masterDokiThemeDefinitionPath: string
): string => {
  const masterThemeFilePath = masterDokiThemeDefinitionPath.substring(
    masterThemeDefinitionDirectoryPath.toString().length
  );
  return `${appDefinitionDirectoryPath}${masterThemeFilePath}`;
};

function buildWindowsTerminalTheme(
  dokiMasterThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeDefinitions: DokiThemeDefinitions,
  dokiWindowsTerminalThemeDefinition: WindowsTerminalDokiThemeDefinition,
  masterDokiThemeDefinitions: DokiThemeDefinitions,
) {

  const lafTemplate = dokiThemeDefinitions[NAMED_COLOR_TYPE].base.colors
  const color1 = resolveNamedColors(dokiThemeDefinitions, dokiMasterThemeDefinition)

  return {
    name: dokiMasterThemeDefinition.name,
    ...applyNamedColors(lafTemplate, color1)
  }
}

function createDokiTheme(
  dokiFileDefinitionPath: string,
  dokiMasterThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeDefinitions: DokiThemeDefinitions,
  dokiWindowsTerminalThemeDefinition: WindowsTerminalDokiThemeDefinition,
  masterDokiThemeDefinitions: DokiThemeDefinitions,
): WindowsTerminalDokiTheme {
  try {
    return {
      path: swapMasterThemeForLocalTheme(dokiFileDefinitionPath),
      definition: dokiMasterThemeDefinition,
      theme: buildWindowsTerminalTheme(
        dokiMasterThemeDefinition,
        dokiThemeDefinitions,
        dokiWindowsTerminalThemeDefinition,
        masterDokiThemeDefinitions
      ),
    };
  } catch (e) {
    console.error(e);
    throw new Error(
      `Unable to build ${dokiMasterThemeDefinition.name}'s theme for reasons ${e}`
    );
  }
}

function ThemeShellConfig(shellConfig: any, t: WindowsTerminalDokiTheme) {
  const background = t.definition.stickers.default;
  return {
    ...shellConfig,
    name: shellConfig.name + ' - ' + t.definition.name,
    backgroundImage: "https://doki.assets.unthrottled.io/backgrounds/" + background.name,
    backgroundImageAlignment: background.anchor,
    backgroundImageStretchMode: 'fill',
    backgroundImageOpacity: 1 - (background.opacity / 100),
    colorScheme: t.definition.name
  }
}

console.log('Preparing to generate themes.');

evaluateTemplates<WindowsTerminalDokiThemeDefinition, WindowsTerminalDokiTheme>(
  {
    appName: 'windowsTerminal',
    currentWorkingDirectory: __dirname,
  },
  createDokiTheme
).then(dokiThemes => {
  fs.writeFileSync(
    path.resolve(
      repoDirectory,
      "generatedThemes",
      'Themes.json'
    ),
    JSON.stringify({
      schemes: dokiThemes.map(d => d.theme)
    }, null, 2)
  )

  walkDir(appTemplatesDirectoryPath).then(dirs => {
    dirs
    .filter(d => d.endsWith('.shell.json'))
    .forEach(d => {
      const shellConfig = readJson<any>(d)
      const shellConfigPath = path.resolve(
        repoDirectory,
        "generatedThemes",
        shellConfig.name
      )

      if (!fs.existsSync(shellConfigPath)){
          fs.mkdirSync(shellConfigPath);
      }

      dokiThemes.forEach(t => {

        fs.writeFileSync(
          path.resolve(
            repoDirectory,
            "generatedThemes",
            shellConfig.name,
            t.definition.name + '.json'
          ),
          JSON.stringify({
            profiles: {
              list: [ThemeShellConfig(shellConfig, t)]
            }
          }, null, 2)
        )

      })
    })
  })
  

  })
  .then(() => {
    console.log('Theme Generation Complete!');
  });