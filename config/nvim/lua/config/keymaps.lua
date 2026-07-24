-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

vim.cmd([[
  function! CopyFilePathAndLine()
    let l:file_path = expand('%:~:.') . ':' . line('.')
    let @+=l:file_path
    echo 'Copied to clipboard: ' . l:file_path
  endfunction
]])

vim.api.nvim_set_keymap("n", "yl", ":call CopyFilePathAndLine()<CR>", { noremap = true, silent = true })
