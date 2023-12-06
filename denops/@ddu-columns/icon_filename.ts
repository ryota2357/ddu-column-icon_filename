import {
  BaseColumn,
  DduItem,
  ItemHighlight,
} from "https://deno.land/x/ddu_vim@v3.8.1/types.ts";
import { GetTextResult } from "https://deno.land/x/ddu_vim@v3.8.1/base/column.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v3.8.1/deps.ts";
import {
  basename,
  extname,
  relative,
} from "https://deno.land/std@0.208.0/path/mod.ts";

type Params = {
  span: number;
  padding: number;
  iconWidth: number;
  pathDisplayOption: "basename" | "relative";
  defaultIcon: IconParam;
  linkIcon: IconParam;
  useLinkIcon: "always" | "grayout" | "default" | "none";
  customSpecialIcons: Record<string, IconParam>;
  customFileIcons: Record<string, IconParam>;
  colors: Record<string, string>;
};

type ActionData = {
  isDirectory?: boolean;
  isLink?: boolean;
  path?: string;
};

type IconParam = {
  icon?: string;
  color?: string;
};

type IconData = {
  icon: string;
  hl_group: string;
  color: string;
};

export class Column extends BaseColumn<Params> {
  private readonly textEncoder = new TextEncoder();

  public override async getLength(args: {
    denops: Denops;
    columnParams: Params;
    items: DduItem[];
  }): Promise<number> {
    const cwd = await fn.getcwd(args.denops);
    const widths = await Promise.all(
      args.items.map(async (item) => {
        const action = item?.action as ActionData;

        let filename: string;
        switch (args.columnParams.pathDisplayOption) {
          case "basename":
            filename = this.getBasenameFilename(
              action.path ?? item.word,
              action.isDirectory ?? false,
            );
            break;

          case "relative":
            filename = this.getRelativeFilename(
              cwd,
              action.path ?? item.word,
              action.isDirectory ?? false,
            );
            break;
        }

        const indent = item.__level + args.columnParams.padding;
        const iconWidth = args.columnParams.iconWidth;
        const span = args.columnParams.span;
        const itemLength = await fn.strdisplaywidth(args.denops, filename);

        return indent + iconWidth + span + itemLength;
      }),
    );
    return Math.max(...widths);
  }

  public override async getText(args: {
    denops: Denops;
    columnParams: Params;
    startCol: number;
    endCol: number;
    item: DduItem;
  }): Promise<GetTextResult> {
    const action = args.item?.action as ActionData;
    const highlights: ItemHighlight[] = [];

    let filename: string;
    switch (args.columnParams.pathDisplayOption) {
      case "basename":
        filename = this.getBasenameFilename(
          action.path ?? args.item.word,
          action.isDirectory ?? false,
        );
        break;

      case "relative":
        filename = this.getRelativeFilename(
          await fn.getcwd(args.denops),
          action.path ?? args.item.word,
          action.isDirectory ?? false,
        );
        break;
    }

    const iconData = this.getIcon(
      // NOTE: If pass `filename` as 1st args, `getIcon()` does not handle specialIcon correctly
      this.getBasenameFilename(
        action.path ?? args.item.word,
        action.isDirectory ?? false,
      ),
      args.item.__expanded,
      action.isLink ?? false,
      args.columnParams,
    );

    // create text
    const indent = this.whitespace(
      args.item.__level + args.columnParams.padding,
    );
    const span = this.whitespace(args.columnParams.span);
    const body = indent + iconData.icon + span + filename;
    const bodyWidth = await fn.strwidth(args.denops, body);
    const padding = this.whitespace(
      Math.max(0, args.endCol - args.startCol - bodyWidth),
    );
    const text = body + padding;

    // set highlight
    const hl_group = `ddu_column_${iconData.hl_group}`;
    const iconByteLength = this.textEncoder.encode(iconData.icon).length;
    const color = (() => {
      const col = iconData.color;
      return col.startsWith("!")
        ? args.columnParams.colors[col.slice(1)] ??
          defaultColors.get(col.slice(1)) ??
          defaultColors.get("default")!
        : col;
    })();
    highlights.push({
      name: "column-icons-icon",
      hl_group: hl_group,
      col: args.startCol + args.columnParams.padding + args.item.__level,
      width: iconByteLength,
    });
    if (color.startsWith("#")) {
      await args.denops.cmd(`hi default ${hl_group} guifg=${color}`);
    } else {
      await args.denops.cmd(`hi default link ${hl_group} ${color}`);
    }

    return {
      text: text,
      highlights: highlights,
    };
  }

  public override params(): Params {
    return {
      span: 1,
      padding: 1,
      iconWidth: 1,
      pathDisplayOption: "basename",
      defaultIcon: { icon: " ", color: "!default" },
      linkIcon: { icon: "", color: "#808080" },
      useLinkIcon: "always",
      customSpecialIcons: {},
      customFileIcons: {},
      colors: {},
    };
  }

  private whitespace(count: number): string {
    return " ".repeat(Math.max(0, count));
  }

  private getBasenameFilename(path: string, isDirectory: boolean): string {
    return basename(path) + (isDirectory ? "/" : "");
  }

  private getRelativeFilename(
    cwd: string,
    path: string,
    isDirectory: boolean,
  ): string {
    return relative(cwd, path) + (isDirectory ? "/" : "");
  }

  // case(1): isLink? and useLinkIcon == always
  //     return linkIcon
  // case(2): match specialIcons
  //     return customSpecialIcon ?? specialIcon.marge(useLinkIcon == "grayout)
  // case(3): isDirectory?
  //     return folderIcons
  // case(4): match fileIcons
  //     return customFileIcon ?? fileIcon.marge(useLinkIcon == "grayout")
  // case(5): isLink? and useLinkIcon == "default"
  //     return linkIcon
  // return defaultIcon
  private getIcon(
    fname: string,
    expanded: boolean,
    isLink: boolean,
    params: Params,
  ): IconData {
    const isDirectory = fname[fname.length - 1] == "/";
    const linkIcon = (() => {
      const icon = params.linkIcon.icon ?? "";
      const color = params.linkIcon.color ?? "#808080";
      return {
        icon: icon,
        hl_group: "link",
        color: color,
      };
    })();

    // case(1)
    if (isLink && params.useLinkIcon == "always") return linkIcon;

    // case(2)
    const sp = (() => {
      const name = fname.toLowerCase();
      const custom = params.customSpecialIcons[name];
      const builtin = specialIcons.get(name);
      return custom
        ? ({
          icon: custom.icon ?? builtin?.icon,
          color: custom.color ?? builtin?.color,
          hl_group: "csp_" + (custom.icon?.charCodeAt(0) ?? 0).toString(),
        } as IconData)
        : builtin;
    })();
    if (sp) {
      if (isLink && params.useLinkIcon == "grayout") {
        sp.hl_group = linkIcon.hl_group;
        sp.color = linkIcon.color;
      }
      return sp;
    }

    // case(3)
    if (isDirectory) {
      return expanded ? folderIcons.expand : folderIcons.collaps;
    }

    // case(4)
    const file = (() => {
      const ext = extname(fname).substring(1);
      const custom = params.customFileIcons[ext];
      const builtin = fileIcons.get(ext);
      return custom
        ? ({
          icon: custom.icon ?? builtin?.icon,
          color: custom.color ?? builtin?.color,
          hl_group: "cfile_" + (custom.icon?.charCodeAt(0) ?? 0).toString(),
        } as IconData)
        : builtin;
    })();
    if (file) {
      if (isLink && params.useLinkIcon == "grayout") {
        file.hl_group = linkIcon.hl_group;
        file.color = linkIcon.color;
      }
      return file;
    }

    // case(5)
    if (isLink && params.useLinkIcon != "none") return linkIcon;

    // default
    const defoIcon = params.defaultIcon.icon ?? " ";
    const defoColor = params.defaultIcon.color ?? "Normal";
    return {
      icon: defoIcon,
      hl_group: "file_default",
      color: defoColor,
    };
  }
}

const defaultColors = new Map<string, string>([
  ["default", "Normal"],
  ["aqua", "#3AFFDB"],
  ["beige", "#F5C06F"],
  ["blue", "#689FB6"],
  ["brown", "#905532"],
  ["darkBlue", "#44788E"],
  ["darkOrange", "#F16529"],
  ["green", "#8FAA54"],
  ["lightGreen", "#31B53E"],
  ["lightPurple", "#834F79"],
  ["orange", "#D4843E"],
  ["pink", "#CB6F6F"],
  ["purple", "#834F79"],
  ["red", "#AE403F"],
  ["salmon", "#EE6E73"],
  ["yellow", "#F09F17"],
]);

// for preventing typo
const palette = {
  default: "!default",
  aqua: "!aqua",
  beige: "!beige",
  blue: "!blue",
  brown: "!brown",
  darkBlue: "!darkBlue",
  darkOrange: "!darkOrange",
  green: "!green",
  lightGreen: "!lightGreen",
  lightPurple: "!lightPurple",
  orange: "!orange",
  pink: "!pink",
  purple: "!purple",
  red: "!red",
  salmon: "!salmon",
  yellow: "!yellow",
};

const folderIcons: Record<"expand" | "collaps", IconData> = {
  expand: { icon: "", hl_group: "folder_expand", color: "Directory" },
  collaps: { icon: "", hl_group: "folder_collaps", color: "Directory" },
};

// deno-fmt-ignore-start
const specialIcons = new Map<string, IconData>([                                                   // nerd font class name
  [".ds_store",           { icon: "", hl_group: "sp_ds_store",      color: palette.default    }], // nf-dev-aptana
  [".editorconfig",       { icon: "", hl_group: "sp_editorconfig",  color: palette.default    }], // nf-dev-aptana
  [".eslintrc.js",        { icon: "", hl_group: "sp_eslintrc",      color: palette.purple     }], // nf-seti-eslint
  [".eslintrc.json",      { icon: "", hl_group: "sp_eslintrc",      color: palette.purple     }], // nf-seti-eslint
  [".eslintrc.yaml",      { icon: "", hl_group: "sp_eslintrc",      color: palette.purple     }], // nf-seti-eslint
  [".eslintrc.yml",       { icon: "", hl_group: "sp_eslintrc",      color: palette.purple     }], // nf-seti-eslint
  [".git/",               { icon: "", hl_group: "sp_git",           color: "Directory"        }], // nf-custom-folder_git
  [".gitconfig",          { icon: "", hl_group: "sp_gitconfig",     color: palette.default    }], // nf-dev-aptana
  [".github/",            { icon: "", hl_group: "sp_github",        color: "Directory"        }], // nf-custom-folder_github
  [".gitignore",          { icon: "", hl_group: "sp_gitignore",     color: palette.darkOrange }], // nf-dev-git
  [".gitlab-ci.yml",      { icon: "", hl_group: "sp_gitlab_ci",     color: palette.default    }], // nf-fa-gitlab
  [".vscode",             { icon: "", hl_group: "sp_vscode",        color: "Directory"        }], // nf-dev-visualstudio
  ["changelog",           { icon: "", hl_group: "sp_changelog",     color: palette.green      }], // nf-fa-history
  ["changelog.md",        { icon: "", hl_group: "sp_changelog",     color: palette.green      }], // nf-fa-history
  ["config.ru",           { icon: "", hl_group: "sp_config_ru",     color: palette.default    }], // nf-dev-ruby
  ["docker-compose.yaml", { icon: "", hl_group: "sp_dockercompose", color: palette.yellow     }], // nf-dev-docker
  ["docker-compose.yml",  { icon: "", hl_group: "sp_dockercompose", color: palette.yellow     }], // nf-dev-docker
  ["dockerfile",          { icon: "", hl_group: "sp_license",       color: palette.blue       }], // nf-dev-docker
  ["dropbox/",            { icon: "", hl_group: "sp_dropbox",       color: "Directory"        }], // nf-dev-dropbox
  ["favicon.ico",         { icon: "", hl_group: "sp_favicon",       color: palette.yellow     }], // nf-seti-favicon
  ["init.vim",            { icon: "", hl_group: "sp_neovim",        color: palette.green      }], // nf-custom-neovim
  ["license",             { icon: "", hl_group: "sp_license",       color: palette.default    }], // nf-seti-license
  ["license.md",          { icon: "", hl_group: "sp_license",       color: palette.default    }], // nf-seti-license
  ["license.txt",         { icon: "", hl_group: "sp_license",       color: palette.default    }], // nf-seti-license
  ["makefile",            { icon: "", hl_group: "sp_gitconfig",     color: palette.default    }], // nf-dev-aptana
  ["node_modules/",       { icon: "", hl_group: "sp_node_module",   color: "Directory"        }], // nf-dev-nodejs_small
  ["readme",              { icon: "", hl_group: "sp_readme",        color: palette.yellow     }], // nf-seti-markdown
  ["readme.md",           { icon: "", hl_group: "sp_readme",        color: palette.yellow     }], // nf-seti-markdown
  ["tailwind.config.cjs", { icon: "󱏿", hl_group: "sp_tailwind",      color: palette.darkBlue   }], // nf-md-tailwind
  ["tailwind.config.js",  { icon: "󱏿", hl_group: "sp_tailwind",      color: palette.darkBlue   }], // nf-md-tailwind
]);
// deno-fmt-ignore-end

// deno-fmt-ignore-start
const fileIcons = new Map<string, IconData>([                                            // nerd font class name
  ["ai",        { icon: "", hl_group: "file_ai",         color: palette.darkOrange  }], // nf-dev-illustrator
  ["apk",       { icon: "", hl_group: "file_apk",        color: palette.green       }], // nf-dev-android
  ["astro",     { icon: "", hl_group: "file_astro",      color: palette.orange      }], // nf-dev-code
  ["awk",       { icon: "", hl_group: "file_awk",        color: palette.default     }], // nf-dev-terminal
  ["bash",      { icon: "", hl_group: "file_bash",       color: palette.default     }], // nf-dev-terminal
  ["bat",       { icon: "", hl_group: "file_bat",        color: palette.default     }], // nf-dev-aptana
  ["blend",     { icon: "󰂫", hl_group: "file_blend",      color: palette.darkOrange  }], // nf-md-blender_software
  ["bmp",       { icon: "", hl_group: "file_bmp",        color: palette.aqua        }], // nf-fa-file_image_o
  ["c",         { icon: "", hl_group: "file_c",          color: palette.blue        }], // nf-custom-c
  ["cc",        { icon: "", hl_group: "file_cc",         color: palette.blue        }], // nf-custom-cpp
  ["cjs",       { icon: "", hl_group: "file_cjs",        color: palette.beige       }], // nf-dev-javascript
  ["clj",       { icon: "", hl_group: "file_clj",        color: palette.green       }], // nf-dev-clojure
  ["cljc",      { icon: "", hl_group: "file_cljc",       color: palette.green       }], // nf-dev-clojure
  ["cljs",      { icon: "", hl_group: "file_cljs",       color: palette.green       }], // nf-dev-clojure_alt
  ["coffee",    { icon: "", hl_group: "file_coffee",     color: palette.brown       }], // nf-dev-coffeescript
  ["conf",      { icon: "", hl_group: "file_conf",       color: palette.default     }], // nf-dev-aptana
  ["cpp",       { icon: "", hl_group: "file_cpp",        color: palette.blue        }], // nf-custom-cpp
  ["cs",        { icon: "󰌛", hl_group: "file_cs",         color: palette.blue        }], // nf-md-language_csharp
  ["csh",       { icon: "", hl_group: "file_csh",        color: palette.default     }], // nf-dev-terminal
  ["css",       { icon: "", hl_group: "file_css",        color: palette.blue        }], // nf-dev-css3
  ["csv",       { icon: "", hl_group: "file_csv",        color: palette.lightGreen  }], // nf-fa-file_excel_o
  ["d",         { icon: "", hl_group: "file_d",          color: palette.red         }], // nf-dev-dlangd
  ["dart",      { icon: "", hl_group: "file_dart",       color: palette.blue        }], // nf-dev-dart
  ["db",        { icon: "", hl_group: "file_db",         color: palette.blue        }], // nf-fa-database
  ["doc",       { icon: "", hl_group: "file_doc",        color: palette.darkBlue    }], // nf-fa-file_word_o
  ["dockerfile",{ icon: "", hl_group: "file_dockerfile", color: palette.blue        }], // nf-dev-docker
  ["docx",      { icon: "", hl_group: "file_docx",       color: palette.darkBlue    }], // nf-fa-file_word_o
  ["dot",       { icon: "󱁊", hl_group: "file_dot",        color: palette.darkBlue    }], // nf-md-graph_outline
  ["elm",       { icon: "", hl_group: "file_elm",        color: palette.default     }], // nf-custom-elm
  ["ex",        { icon: "", hl_group: "file_ex",         color: palette.lightPurple }], // nf-custom-elixir
  ["exs",       { icon: "", hl_group: "file_exs",        color: palette.lightPurple }], // nf-custom-elixir
  ["fish",      { icon: "", hl_group: "file_fish",       color: palette.green       }], // nf-dev-terminal
  ["fs",        { icon: "", hl_group: "file_fs",         color: palette.blue        }], // nf-dev-fsharp
  ["fsx",       { icon: "", hl_group: "file_fsx",        color: palette.blue        }], // nf-dev-fsharp
  ["gif",       { icon: "", hl_group: "file_gif",        color: palette.aqua        }], // nf-fa-file_image_o
  ["go",        { icon: "", hl_group: "file_go",         color: palette.beige       }], // nf-dev-go
  ["gz",        { icon: "", hl_group: "file_gz",         color: palette.default     }], // nf-oct-file_zip
  ["h",         { icon: "", hl_group: "file_h",          color: palette.default     }], // nf-fa-h_square
  ["hpp",       { icon: "", hl_group: "file_hpp",        color: palette.default     }], // nf-fa-h_square
  ["hs",        { icon: "", hl_group: "file_hs",         color: palette.beige       }], // nf-dev-haskell
  ["html",      { icon: "", hl_group: "file_html",       color: palette.darkOrange  }], // nf-dev-html5
  ["ico",       { icon: "", hl_group: "file_ico",        color: palette.aqua        }], // nf-fa-file_image_o
  ["java",      { icon: "", hl_group: "file_java",       color: palette.purple      }], // nf-dev-java
  ["jl",        { icon: "", hl_group: "file_jl",         color: palette.purple      }], // nf-seti-julia
  ["jpeg",      { icon: "", hl_group: "file_jpeg",       color: palette.aqua        }], // nf-fa-file_image_o
  ["jpg",       { icon: "", hl_group: "file_jpg",        color: palette.aqua        }], // nf-fa-file_image_o
  ["js",        { icon: "", hl_group: "file_js",         color: palette.beige       }], // nf-dev-javascript
  ["json",      { icon: "", hl_group: "file_json",       color: palette.beige       }], // nf-seti-json
  ["jsx",       { icon: "", hl_group: "file_jsx",        color: palette.blue        }], // nf-dev-react
  ["lock",      { icon: "", hl_group: "file_lock",       color: palette.beige       }], // nf-fa-lock
  ["log",       { icon: "", hl_group: "file_log",        color: palette.yellow      }], // nf-oct-file
  ["lua",       { icon: "󰢱", hl_group: "file_lua",        color: palette.purple      }], // nf-md-language_lua
  ["md",        { icon: "", hl_group: "file_md",         color: palette.blue        }], // nf-dev-markdown
  ["mdx",       { icon: "", hl_group: "file_mdx",        color: palette.blue        }], // nf-dev-markdown
  ["mjs",       { icon: "", hl_group: "file_mjs",        color: palette.beige       }], // nf-dev-javascript
  ["mov",       { icon: "", hl_group: "file_mov",        color: palette.orange      }], // nf-fa-file_movie_o
  ["mp3",       { icon: "", hl_group: "file_mp3",        color: palette.salmon      }], // nf-fa-file_audio_o
  ["mp4",       { icon: "", hl_group: "file_mp4",        color: palette.orange      }], // nf-fa-file_movie_o
  ["otf",       { icon: "", hl_group: "file_otf",        color: palette.red         }], // nf-fa-font
  ["pdf",       { icon: "", hl_group: "file_pdf",        color: palette.darkOrange  }], // nf-fa-file_pdf_o
  ["php",       { icon: "", hl_group: "file_php",        color: palette.purple      }], // nf-dev-php
  ["pl",        { icon: "", hl_group: "file_pl",         color: palette.blue        }], // nf-dev-perl
  ["pm",        { icon: "", hl_group: "file_pm",         color: palette.blue        }], // nf-dev-perl
  ["png",       { icon: "", hl_group: "file_png",        color: palette.aqua        }], // nf-fa-file_image_o
  ["pp",        { icon: "", hl_group: "file_pp",         color: palette.default     }], // nf-oct-beaker
  ["ppm",       { icon: "", hl_group: "file_ppm",        color: palette.aqua        }], // nf-fa-file_image_o
  ["ppt",       { icon: "", hl_group: "file_ppt",        color: palette.orange      }], // nf-fa-file_powerpoint_o
  ["pptx",      { icon: "", hl_group: "file_pptx",       color: palette.orange      }], // nf-fa-file_powerpoint_o
  ["psd",       { icon: "", hl_group: "file_psd",        color: palette.darkBlue    }], // nf-dev-photoshop
  ["py",        { icon: "", hl_group: "file_py",         color: palette.yellow      }], // nf-dev-python
  ["rake",      { icon: "", hl_group: "file_rake",       color: palette.red         }], // nf-dev-ruby_rough
  ["rb",        { icon: "", hl_group: "file_rb",         color: palette.red         }], // nf-dev-ruby_rough
  ["rmd",       { icon: "", hl_group: "file_rmd",        color: palette.blue        }], // nf-dev-markdown
  ["rs",        { icon: "", hl_group: "file_rs",         color: palette.red         }], // nf-dev-rust
  ["rss",       { icon: "", hl_group: "file_rss",        color: palette.darkOrange  }], // nf-fa-rss
  ["sass",      { icon: "", hl_group: "file_sass",       color: palette.default     }], // nf-dev-sass
  ["scala",     { icon: "", hl_group: "file_scala",      color: palette.red         }], // nf-dev-scala
  ["scm",       { icon: "", hl_group: "file_scm",        color: palette.salmon      }], // nf-custom-scheme
  ["scss",      { icon: "", hl_group: "file_scss",       color: palette.pink        }], // nf-dev-sass
  ["sh",        { icon: "", hl_group: "file_sh",         color: palette.lightPurple }], // nf-dev-terminal
  ["slim",      { icon: "", hl_group: "file_slim",       color: palette.orange      }], // nf-seti-html
  ["sln",       { icon: "", hl_group: "file_sln",        color: palette.purple      }], // nf-dev-visualstudio
  ["styl",      { icon: "", hl_group: "file_styl",       color: palette.green       }], // nf-dev-stylus
  ["swift",     { icon: "", hl_group: "file_swift",      color: palette.orange      }], // nf-dev-swift
  ["tex",       { icon: "", hl_group: "file_tex",        color: palette.default     }], // nf-seti-tex
  ["toml",      { icon: "", hl_group: "file_toml",       color: palette.default     }], // nf-custom-toml
  ["ts",        { icon: "", hl_group: "file_ts",         color: palette.blue        }], // nf-seti-typescript
  ["tsx",       { icon: "", hl_group: "file_tsx",        color: palette.blue        }], // nf-dev-react
  ["ttf",       { icon: "", hl_group: "file_ttf",        color: palette.red         }], // nf-fa-font
  ["txt",       { icon: "", hl_group: "file_txt",        color: palette.default     }], // nf-fa-file_text
  ["vim",       { icon: "", hl_group: "file_vim",        color: palette.green       }], // nf-dev-vim
  ["vue",       { icon: "󰡄", hl_group: "file_vue",        color: palette.green       }], // nf-md-vuejs
  ["webp",      { icon: "", hl_group: "file_webp",       color: palette.aqua        }], // nf-fa-file_image_o
  ["woff",      { icon: "", hl_group: "file_woff",       color: palette.red         }], // nf-fa-font
  ["woff2",     { icon: "", hl_group: "file_woff2",      color: palette.red         }], // nf-fa-font
  ["xls",       { icon: "", hl_group: "file_xls",        color: palette.lightGreen  }], // nf-fa-file_excel_o
  ["xlsx",      { icon: "", hl_group: "file_xlsx",       color: palette.lightGreen  }], // nf-fa-file_excel_o
  ["yaml",      { icon: "", hl_group: "file_yaml",       color: palette.default     }], // nf-dev-aptana
  ["yml",       { icon: "", hl_group: "file_yml",        color: palette.default     }], // nf-dev-aptana
  ["zip",       { icon: "", hl_group: "file_zip",        color: palette.default     }], // nf-oct-file_zip
  ["zsh",       { icon: "", hl_group: "file_zsh",        color: palette.default     }], // nf-dev-terminal
]);
// deno-fmt-ignore-end
