return {
  {
    "nvim-telescope/telescope.nvim",
    dependencies = {
      {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "make",
      },
    },
    opts = function(_, opts)
      local telescope = require("telescope")

      opts.defaults = vim.tbl_deep_extend("force", opts.defaults or {}, {
        wrap_results = true,
        layout_strategy = "vertical",
        layout_config = { prompt_position = "bottom", height = 0.95, width = 0.95 },
        sorting_strategy = "descending",
        winblend = 0,
        mappings = {
          n = {
            ["<C-k>"] = require("telescope.actions").preview_scrolling_up,
            ["<C-j>"] = require("telescope.actions").preview_scrolling_down,
          },
        },
      })

      opts.pickers = {
        diagnostics = {
          initial_mode = "normal",
          layout_strategy = "vertical",
          layout_config = {
            preview_cutoff = 9999,
            height = 0.95,
            width = 0.95,
          },
        },
      }
      telescope.setup(opts)
      require("telescope").load_extension("fzf")
    end,
  },
}
