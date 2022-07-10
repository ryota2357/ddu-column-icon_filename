import {
  BaseColumn,
  DduItem,
  ItemHighlight,
} from "https://deno.land/x/ddu_vim@v1.8.0/types.ts";
import { GetTextResult } from "https://deno.land/x/ddu_vim@v1.8.0/base/column.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v1.8.0/deps.ts";
import { basename } from "https://deno.land/std@0.141.0/path/mod.ts";

type Params = {
  iconWidth: number;
  highlights: HighlightGroup;
};

type HighlightGroup = {
  directoryIcon?: string;
  directoryName?: string;
};

type ActionData = {
  isDirectory?: boolean;
  path?: string;
};

export class Column extends BaseColumn<Params> {
  public async getLength(
    args: { denops: Denops; columnParams: Params; items: DduItem[] },
  ): Promise<number> {
    const widths = await Promise.all(
      args.items.map(async (item) => {
        const iconWidth = args.columnParams.iconWidth;
        const itemLength = await fn.strwidth(
          args.denops,
          item.display ?? item.word,
        ) as number;
        return item.__level + 1 + iconWidth + itemLength;
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
    const path = basename(action.path ?? args.item.word) +
      (action.isDirectory ? "/" : "");
    const iconData = action.isDirectory
      ? this.getDirectoryIcon(args.item.__expanded)
      : this.getFileIcon(path);

    // create text
    const indent = " ".repeat(args.item.__level);
    const body = indent + iconData.icon + " " + path;
    const width = await fn.strwidth(args.denops, body) as number;
    const padding = " ".repeat(
      Math.max(0, args.endCol - args.startCol - width),
    );
    const text = body + padding;

    return Promise.resolve({
      text: text,
      highlights: highlights,
    });
  }

  public params(): Params {
    return {
      iconWidth: 2,
      highlights: {},
    };
  }

  private getDirectoryIcon(expanded: boolean): IconData {
    return expanded ? folderIcons.expand : folderIcons.collaps;
  }

  private getFileIcon(path: string): IconData {
    const extention = path.substring(path.lastIndexOf(".") + 1);
    return (fileIcons.get(extention) ?? { icon: " " });
  }
}

type IconData = {
  icon: string;
};

const folderIcons: Record<"expand" | "collaps", IconData> = {
  expand: { icon: "" },
  collaps: { icon: "" },
};

// deno-fmt-ignore-start
const fileIcons = new Map<string, IconData>([
  ["awk",   { icon: "" }], // nf-dev-terminal
  ["bash",  { icon: "" }], // nf-dev-terminal
  ["c",     { icon: "" }], // nf-custom-c
  ["conf",  { icon: "" }], // nf-dev-aptana
  ["cpp",   { icon: "" }], // nf-custom-cpp
  ["cs",    { icon: "" }], // nf-mdi-language_csharp
  ["css",   { icon: "" }], // nf-dev-css3
  ["d",     { icon: "" }], // nf-dev-dlangd
  ["dart",  { icon: "" }], // nf-dev-dart
  ["fish",  { icon: "" }], // nf-dev-terminal
  ["fs",    { icon: "" }], // nf-dev-fsharp
  ["go",    { icon: "" }], // nf-dev-go
  ["hs",    { icon: "" }], // nf-dev-haskell
  ["html",  { icon: "" }], // nf-dev-html5
  ["java",  { icon: "" }], // nf-dev-java
  ["jpg",   { icon: "" }], // nf-seti-image
  ["jpeg",  { icon: "" }], // nf-seti-image
  ["js",    { icon: "" }], // nf-dev-javascript
  ["jsx",   { icon: "" }], // nf-dev-react
  ["json",  { icon: "" }], // nf-seti-json
  ["lock",  { icon: "" }], // nf-fa-lock
  ["lua",   { icon: "" }], // nf-seti-lua
  ["md",    { icon: "" }], // nf-dev-markdown
  ["php",   { icon: "" }], // nf-dev-php
  ["png",   { icon: "" }], // nf-seti-image
  ["py",    { icon: "" }], // nf-dev-python
  ["rb",    { icon: "" }], // nf-dev-ruby
  ["rs",    { icon: "" }], // nf-dev-rust
  ["sass",  { icon: "" }], // nf-dev-sass
  ["scss",  { icon: "" }], // nf-dev-sass
  ["sh",    { icon: "" }], // nf-dev-terminal
  ["swift", { icon: "" }], // nf-dev-swift
  ["toml",  { icon: "" }], // nf-dev-aptana
  ["ts",    { icon: "" }], // nf-seti-typescript
  ["tsx",   { icon: "" }], // nf-dev-react
  ["vim",   { icon: "" }], // nf-dev-vim
  ["zsh",   { icon: "" }], // nf-dev-terminal
]);
// deno-fmt-ignore-end
