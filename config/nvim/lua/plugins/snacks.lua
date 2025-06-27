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
      },
    },
  },
}