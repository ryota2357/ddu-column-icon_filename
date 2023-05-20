# ddu-column-icon_filename

Icon and filename column for ddu.vim

## Required

### denops.vim

https://github.com/vim-denops/denops.vim

### ddu.vim

https://github.com/Shougo/ddu.vim

## Configuration

```vim
call ddu#custom#patch_global({
    \   'columns': ['icon_filename'],
    \ })
```

## Screenshots

<img width="295" alt="filer" src="https://github.com/ryota2357/ddu-column-icon_filename/assets/61523777/4e30814c-ceca-437b-aa99-9c3d8deb5dbf">

<img width="653" alt="ff" src="https://github.com/ryota2357/ddu-column-icon_filename/assets/61523777/5dd88b68-91ad-4e30-9940-4782f1471fb1">

### Screenshots config

```vim
ddu#custom#alias('column', 'icon_filename_for_ff', 'icon_filename')
call ddu#custom#patch_global({
  \   sourceOptions: #{
  \     file: #{
  \       columns: ['icon_filename']
  \     },
  \     file_rec: #{
  \       columns: ['icon_filename_for_ff']
  \     },
  \   },
  \   columnParams: #{
  \     icon_filename: #{
  \       defaultIcon: #{ icon = '' },
  \     },
  \     icon_filename_for_ff: #{
  \       defaultIcon: #{ icon = '' },
  \       padding = 0,
  \       pathDisplayOption = "relative"
  \     }
  \   }
  \ })
```
