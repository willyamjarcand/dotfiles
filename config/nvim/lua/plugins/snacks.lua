return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      layout = {
        preset = "vertical",
      },
      win = {
        input = {
          keys = {
            ["<C-k>"] = { "preview_scroll_up", mode = { "i", "n" } },
            ["<C-j>"] = { "preview_scroll_down", mode = { "i", "n" } },
            ["<C-n>"] = { "list_down", mode = { "i", "n" } },
            ["<C-p>"] = { "list_up", mode = { "i", "n" } },
          },
        },
        list = {
          keys = {
            ["<C-e>"] = { "toggle_maximize", mode = { "i", "n" } },
          },
        },
      },
    },
  },
  keys = {
    {
      "<leader>sg",
      function()
        Snacks.picker.grep({
          args = { "--glob", "!*_spec.rb", "--glob", "!*_task.rb" },
        })
      end,
      desc = "Grep (exclude spec/task files)",
    },
    {
      "<leader>fw",
      function()
        local word = vim.fn.expand("<cword>")
        Snacks.picker.grep({
          search = word,
          args = { "--glob", "!*_spec.rb", "--glob", "!*_task.rb" },
        })
      end,
      desc = "Grep word under cursor (exclude spec/task)",
    },
  },
}
