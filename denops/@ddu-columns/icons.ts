import {
  BaseColumn,
  DduItem,
  ItemHighlight,
} from "https://deno.land/x/ddu_vim@v1.8.7/types.ts";
import { GetTextResult } from "https://deno.land/x/ddu_vim@v1.8.7/base/column.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v1.8.7/deps.ts";
import { basename, extname } from "https://deno.land/std@0.147.0/path/mod.ts";

type Params = {
  span: number;
  defaultIcon: IconData;
};

type ActionData = {
  isDirectory?: boolean;
  path?: string;
};

type IconData = {
  icon: string;
  hl_group: string;
  color: string;
};

export class Column extends BaseColumn<Params> {
  public async getLength(
    args: { denops: Denops; columnParams: Params; items: DduItem[] },
  ): Promise<number> {
    const widths = await Promise.all(
      args.items.map(async (item) => {
        const action = item?.action as ActionData;
        const filename = this.getFilename(
          action.path ?? item.word,
          action.isDirectory ?? false,
        );

        const indent = item.__level;
        const iconWidth = await fn.strwidth(
          args.denops,
          (this.getIcon(filename) ?? args.columnParams.defaultIcon).icon,
        ) as number;
        const span = args.columnParams.span;
        const itemLength = await fn.strwidth(args.denops, filename) as number;

        return indent + iconWidth + span + itemLength;
      }),
    );
    return Math.max(...widths);
  }

  public async getText(args: {
    denops: Denops;
    columnParams: Params;
    startCol: number;
    endCol: number;
    item: DduItem;
  }): Promise<GetTextResult> {
    const action = args.item?.action as ActionData;
    const highlights: ItemHighlight[] = [];
    const filename = this.getFilename(
      action.path ?? args.item.word,
      action.isDirectory ?? false,
    );

    const iconData = this.getIcon(filename, args.item.__expanded) ??
      args.columnParams.defaultIcon;

    // create text
    const indent = this.whitespace(args.item.__level);
    const span = this.whitespace(args.columnParams.span);
    const body = indent + iconData.icon + span + filename;
    const bodyWidth = await fn.strwidth(args.denops, body) as number;
    const padding = this.whitespace(
      Math.max(0, args.endCol - args.startCol - bodyWidth),
    );
    const text = body + padding;

    // set highlight
    const hl_group = `ddu_column_${iconData.hl_group}`;
    const iconWidth = await fn.strwidth(args.denops, iconData.icon) as number;
    highlights.push({
      name: "column-icons-icon",
      hl_group: hl_group,
      col: args.startCol + args.item.__level + iconWidth + 1,
      width: iconWidth,
    });
    if (iconData.color[0] == "#") {
      await args.denops.cmd(`hi default ${hl_group} guifg=${iconData.color}`);
    } else {
      await args.denops.cmd(`hi default link ${hl_group} ${iconData.color}`);
    }

    return {
      text: text,
      highlights: highlights,
    };
  }

  public params(): Params {
    return {
      span: 1,
      defaultIcon: { icon: " ", hl_group: "file-default", color: "Normal" },
    };
  }

  private whitespace(count: number): string {
    return " ".repeat(Math.max(0, count));
  }

  private getFilename(path: string, isDirectory: boolean): string {
    return basename(path) + (isDirectory ? "/" : "");
  }

  private getIcon(path: string, expanded = false): IconData | undefined {
    const sp = specialIcons.get(path);
    if (sp) return sp;
    if (path[path.length - 1] == "/") {
      return expanded ? folderIcons.expand : folderIcons.collaps;
    }
    const extention = extname(path).substring(1);
    return fileIcons.get(extention);
  }
}

const colors = {
  brown: "#905532",
  aqua: "#3AFFDB",
  blue: "#689FB6",
  darkBlue: "#44788E",
  purple: "#834F79",
  lightPurple: "#834F79",
  red: "#AE403F",
  beige: "#F5C06F",
  yellow: "#F09F17",
  orange: "#D4843E",
  darkOrange: "#F16529",
  pink: "#CB6F6F",
  salmon: "#EE6E73",
  green: "#8FAA54",
  lightGreen: "#31B53E",
  default: "Normal",
} as const;

const folderIcons: Record<"expand" | "collaps", IconData> = {
  expand: { icon: "", hl_group: "folder_expand", color: "Directory" },
  collaps: { icon: "", hl_group: "folder_collaps", color: "Directory" },
};

const specialIcons = new Map<string, IconData>([]);

// deno-fmt-ignore-start
const fileIcons = new Map<string, IconData>([                                  // nerd font class name
  ["awk",    { icon: "", hl_group: "file_awk",    color: colors.default     }], // nf-dev-terminal
  ["bash",   { icon: "", hl_group: "file_bash",   color: colors.default     }], // nf-dev-terminal
  ["c",      { icon: "", hl_group: "file_c",      color: colors.blue        }], // nf-custom-c
  ["coffee", { icon: "", hl_group: "file_coffee", color: colors.brown       }], // nf-dev-coffeescript
  ["conf",   { icon: "", hl_group: "file_conf",   color: colors.default     }], // nf-dev-aptana
  ["cpp",    { icon: "", hl_group: "file_cpp",    color: colors.blue        }], // nf-custom-cpp
  ["cs",     { icon: "", hl_group: "file_cs",     color: colors.blue        }], // nf-mdi-language_csharp
  ["css",    { icon: "", hl_group: "file_css",    color: colors.blue        }], // nf-dev-css3
  ["d",      { icon: "", hl_group: "file_d",      color: colors.red         }], // nf-dev-dlangd
  ["dart",   { icon: "", hl_group: "file_dart",   color: colors.blue        }], // nf-dev-dart
  ["elm",    { icon: "", hl_group: "file_elm",    color: colors.default     }], // nf-dev-dart
  ["fish",   { icon: "", hl_group: "file_fish",   color: colors.green       }], // nf-dev-terminal
  ["fs",     { icon: "", hl_group: "file_fs",     color: colors.blue        }], // nf-dev-fsharp
  ["fsx",    { icon: "", hl_group: "file_fsx",    color: colors.blue        }], // nf-dev-fsharp
  ["gif",    { icon: "", hl_group: "file_gif",    color: colors.aqua        }], // nf-fa-file_image_o
  ["go",     { icon: "", hl_group: "file_go",     color: colors.beige       }], // nf-dev-go
  ["hs",     { icon: "", hl_group: "file_hs",     color: colors.beige       }], // nf-dev-haskell
  ["html",   { icon: "", hl_group: "file_html",   color: colors.darkOrange  }], // nf-dev-html5
  ["java",   { icon: "", hl_group: "file_java",   color: colors.purple      }], // nf-dev-java
  ["jpg",    { icon: "", hl_group: "file_jpg",    color: colors.aqua        }], // nf-fa-file_image_o
  ["jpeg",   { icon: "", hl_group: "file_jpeg",   color: colors.aqua        }], // nf-fa-file_image_o
  ["js",     { icon: "", hl_group: "file_js",     color: colors.beige       }], // nf-dev-javascript
  ["jsx",    { icon: "", hl_group: "file_jsx",    color: colors.blue        }], // nf-dev-react
  ["json",   { icon: "", hl_group: "file_json",   color: colors.beige       }], // nf-seti-json
  ["lock",   { icon: "", hl_group: "file_lock",   color: colors.default     }], // nf-fa-lock
  ["lua",    { icon: "", hl_group: "file_lua",    color: colors.purple      }], // nf-seti-lua
  ["md",     { icon: "", hl_group: "file_md",     color: colors.yellow      }], // nf-dev-markdown
  ["mdx",    { icon: "", hl_group: "file_mdx",    color: colors.yellow      }], // nf-dev-markdown
  ["mp3",    { icon: "", hl_group: "file_mp3",    color: colors.aqua        }], // nf-fa-file_audio_o
  ["pdf",    { icon: "", hl_group: "file_pdf",    color: colors.darkOrange  }], // nf-oct-file_pdf
  ["php",    { icon: "", hl_group: "file_php",    color: colors.purple      }], // nf-dev-php
  ["png",    { icon: "", hl_group: "file_png",    color: colors.aqua        }], // nf-seti-image
  ["py",     { icon: "", hl_group: "file_py",     color: colors.yellow      }], // nf-dev-python
  ["rb",     { icon: "", hl_group: "file_rb",     color: colors.red         }], // nf-dev-ruby
  ["rs",     { icon: "", hl_group: "file_rs",     color: colors.red         }], // nf-dev-rust
  ["sass",   { icon: "", hl_group: "file_sass",   color: colors.default     }], // nf-dev-sass
  ["scala",  { icon: "", hl_group: "file_scala",  color: colors.red         }], // nf-dev-scala
  ["scss",   { icon: "", hl_group: "file_scss",   color: colors.pink        }], // nf-dev-sass
  ["sh",     { icon: "", hl_group: "file_sh",     color: colors.lightPurple }], // nf-dev-terminal
  ["sln",    { icon: "", hl_group: "file_sln",    color: colors.purple      }], // nf-dev-terminal
  ["swift",  { icon: "", hl_group: "file_swift",  color: colors.orange      }], // nf-dev-swift
  ["toml",   { icon: "", hl_group: "file_toml",   color: colors.default     }], // nf-dev-aptana
  ["ts",     { icon: "", hl_group: "file_ts",     color: colors.blue        }], // nf-seti-typescript
  ["tsx",    { icon: "", hl_group: "file_tsx",    color: colors.blue        }], // nf-dev-react
  ["txt",    { icon: "", hl_group: "file_txt",    color: colors.default     }], // nf-seti-text
  ["vim",    { icon: "", hl_group: "file_vim",    color: colors.green       }], // nf-dev-vim
  ["vue",    { icon: "﵂", hl_group: "file_vue",    color: colors.green       }], // nf-mdi-vuejs
  ["webp",   { icon: "", hl_group: "file_webp",   color: colors.aqua        }], // nf-fa-file_image_o
  ["zsh",    { icon: "", hl_group: "file_zip",    color: colors.default     }], // nf-dev-terminal
  ["zsh",    { icon: "", hl_group: "file_zsh",    color: colors.default     }], // nf-dev-terminal
]);
// deno-fmt-ignore-end
