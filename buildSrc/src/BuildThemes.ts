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
  LAF_TYPE,
  SYNTAX_TYPE,
  walkDir,
  readJson,
  resolveColor
} from "doki-build-source";
import path from 'path';
import fs from "fs";

const glob = require("glob");

/*

  Doki Windows terminal theme genetator

  NAMED_COLOR_TYPE used for Windows Terminal color scheme
  LAF_TYPE         used for Windows Terminal shell config
  SYNTAX_TYPE      used for Oh My Posh theme 

*/

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
  terminalTheme: any;
  ompTheme: any;
  shellThemes: StringDictionary<any>;
};

const swapMasterThemeForLocalTheme = (
  masterDokiThemeDefinitionPath: string
): string => {
  const masterThemeFilePath = masterDokiThemeDefinitionPath.substring(
    masterThemeDefinitionDirectoryPath.toString().length
  );
  return `${appDefinitionDirectoryPath}${masterThemeFilePath}`;
};

function buildTerminalTheme(
  dokiMasterThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeDefinitions: DokiThemeDefinitions,
  dokiWindowsTerminalThemeDefinition: WindowsTerminalDokiThemeDefinition,
  masterDokiThemeDefinitions: DokiThemeDefinitions,
) {

  const colorTemplate = dokiThemeDefinitions[NAMED_COLOR_TYPE].base.colors
  const resolvedColors = resolveNamedColors(dokiThemeDefinitions, dokiMasterThemeDefinition)

  return {
    name: dokiMasterThemeDefinition.name,
    ...applyNamedColors(colorTemplate, resolvedColors)
  }
}

function buildOMPTheme(
  dokiMasterThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeDefinitions: DokiThemeDefinitions,
  dokiWindowsTerminalThemeDefinition: WindowsTerminalDokiThemeDefinition,
  masterDokiThemeDefinitions: DokiThemeDefinitions,
) {
  

  let syntaxTemplate = JSON.parse(JSON.stringify(dokiThemeDefinitions[SYNTAX_TYPE].base));
  const resolvedColors = resolveNamedColors(dokiThemeDefinitions, dokiMasterThemeDefinition)
  syntaxTemplate.palette = applyNamedColors(syntaxTemplate.palette, resolvedColors)

  return syntaxTemplate
}

function buildShellConfigs(
  dokiFileDefinitionPath: string,
  dokiMasterThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeDefinitions: DokiThemeDefinitions,
  dokiWindowsTerminalThemeDefinition: WindowsTerminalDokiThemeDefinition,
  masterDokiThemeDefinitions: DokiThemeDefinitions,
) {

  let ret: StringDictionary<any> = {};
  const assetRoot = "https://doki.assets.unthrottled.io"
  const themeDefs = dokiThemeDefinitions[LAF_TYPE]
  const resolvedColors = resolveNamedColors(dokiThemeDefinitions, dokiMasterThemeDefinition)

  Object.keys(themeDefs).forEach(d => {
    if(!themeDefs[d].extends)
      return

    const background = dokiMasterThemeDefinition.stickers.default;
    
    const stickerPath = path
       .resolve(dokiFileDefinitionPath, '..')
       .substring(appDefinitionDirectoryPath.length + 2)

    const resolvedConfig = {
      sticker: assetRoot + '/stickers/smol' + stickerPath.replace(new RegExp('\\\\', 'g'), '/') + '/' + background.name,
      backgroundImage: assetRoot + "/backgrounds/wallpapers/" + background.name,

      ...resolvedColors
    }

    const resolvedLafTemplate = composeTemplate(
      themeDefs[d],
      themeDefs,
      (template) => template,
      (template) => template.extends?.split(',')
    );

    if(resolvedLafTemplate.commandline) {
      resolvedLafTemplate.commandline = resolvedLafTemplate.commandline.replace('%name%', dokiMasterThemeDefinition.name)
    }

    resolvedLafTemplate.name = d + ' - ' + dokiMasterThemeDefinition.name

    ret[d] = {
      backgroundImageAlignment: background.anchor,
      backgroundImageOpacity: 1 - (background.opacity / 100),
      opacity: 100 - background.opacity,
      colorScheme: dokiMasterThemeDefinition.name,
      
      ...applyNamedColors(resolvedLafTemplate, resolvedConfig)
    }
  })

  return ret;
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
      terminalTheme: buildTerminalTheme(
        dokiMasterThemeDefinition,
        dokiThemeDefinitions,
        dokiWindowsTerminalThemeDefinition,
        masterDokiThemeDefinitions
      ),
      ompTheme: buildOMPTheme(
        dokiMasterThemeDefinition,
        dokiThemeDefinitions,
        dokiWindowsTerminalThemeDefinition,
        masterDokiThemeDefinitions
      ),
      shellThemes: buildShellConfigs(
        dokiFileDefinitionPath,
        dokiMasterThemeDefinition,
        dokiThemeDefinitions,
        dokiWindowsTerminalThemeDefinition,
        masterDokiThemeDefinitions
      )
    };
  } catch (e) {
    console.error(e);
    throw new Error(
      `Unable to build ${dokiMasterThemeDefinition.name}'s theme for reasons ${e}`
    );
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

  // Write shell themes
  fs.writeFileSync(
    path.resolve(
      repoDirectory,
      "generatedThemes",
      'Themes.json'
    ),
    JSON.stringify({
      schemes: dokiThemes.map(d => d.terminalTheme)
    }, null, 2)
  )

  // Write sell configs
  dokiThemes.forEach(t => {

    Object.keys(t.shellThemes).forEach(s => {

      const shellConfigPath = path.resolve(
        repoDirectory,
        "generatedThemes",
        s
      )

      if (!fs.existsSync(shellConfigPath)){
        fs.mkdirSync(shellConfigPath);
      }

      fs.writeFileSync(
        path.resolve(
          repoDirectory,
          "generatedThemes",
          s,
          t.definition.name + '.json'
        ),
        JSON.stringify({
          profiles: {
            list: [t.shellThemes[s]]
          }
        }, null, 2)
      )

    })
  })

  // Write OMP themes
  const ompThemePath = path.resolve(
    repoDirectory,
    "generatedThemes",
    "OMP"
  )

  if (!fs.existsSync(ompThemePath)){
    fs.mkdirSync(ompThemePath);
  }

  dokiThemes.forEach(t => {
    fs.writeFileSync(
      path.resolve(
        repoDirectory,
        "generatedThemes",
        "OMP",
        t.definition.name + '.omp.json'
      ),
      JSON.stringify(t.ompTheme, null, 2)
    )
  })

  })
  .then(() => {
    console.log('Theme Generation Complete!');
  });