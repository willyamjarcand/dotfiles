-- Obsidian voice capture
-- Hold a mouse button → record → release → route via claude

local SOX            = "/opt/homebrew/bin/sox"
local AUDIO_PATH     = "/tmp/obsidian-voice-capture.wav"
local ROUTE_SH       = os.getenv("HOME") .. "/.config/obsidian-voice/route.sh"
local MAX_SECONDS    = 60

-- Audio input device. Empty string = system default. Pin to a specific device
-- name to bypass system default (useful when default is a virtual/loopback).
-- Check device names with: system_profiler SPAudioDataType
local AUDIO_DEVICE   = "Shure MV7"

-- Which mouse button to bind. macOS numbers extra buttons 2+ (left=0, right=1).
-- Common spare buttons: 3 = middle/scroll-click, 4 = back/thumb, 5 = forward/thumb.
-- If unsure: set DISCOVER = true, reload, click each mouse button, watch the
-- Hammerspoon Console (menubar icon → Console) for the button number, then set
-- TARGET_BUTTON to that number and flip DISCOVER back to false.
local TARGET_BUTTON  = 4
local DISCOVER       = false

local recorder = nil

local function alert(msg, dur)
    hs.alert.closeAll()
    hs.alert.show(msg, { textSize = 18, radius = 8 }, dur or 1.2)
end

local function startRecording()
    if recorder then return end
    local args
    if AUDIO_DEVICE == "" then
        args = { "-d" }
    else
        args = { "-t", "coreaudio", AUDIO_DEVICE }
    end
    -- output format
    for _, a in ipairs({
        "-r", "16000",
        "-c", "1", "-b", "16",
        AUDIO_PATH,
        "trim", "0", tostring(MAX_SECONDS),
    }) do
        table.insert(args, a)
    end
    recorder = hs.task.new(SOX, nil, args)
    recorder:start()
    alert("🎙️  Recording…", 0.5)
end

local function stopAndRoute()
    if not recorder then return end
    recorder:terminate()
    recorder = nil
    hs.timer.doAfter(0.15, function()
        alert("⏳ Routing…", 1.0)
        hs.task.new(ROUTE_SH, function(exitCode, stdOut, stdErr)
            local out = (stdOut or ""):gsub("%s+$", "")
            if exitCode == 0 and out ~= "" then
                alert("✅ " .. out:sub(1, 120), 4)
            elseif exitCode == 0 then
                alert("✅ captured", 2)
            else
                local err = (stdErr or "error"):gsub("%s+$", "")
                alert("❌ " .. err:sub(1, 120), 5)
                print("[obsidian-voice] error:\n" .. (stdErr or ""))
            end
        end, { AUDIO_PATH }):start()
    end)
end

local mouseTap = hs.eventtap.new({
    hs.eventtap.event.types.otherMouseDown,
    hs.eventtap.event.types.otherMouseUp,
}, function(event)
    local btn = event:getProperty(hs.eventtap.event.properties.mouseEventButtonNumber)

    if DISCOVER then
        if event:getType() == hs.eventtap.event.types.otherMouseDown then
            print("[obsidian-voice] mouse button pressed: " .. tostring(btn))
            hs.alert.show("button " .. tostring(btn), 1)
        end
        return false  -- don't swallow the event during discovery
    end

    if btn ~= TARGET_BUTTON then return false end

    if event:getType() == hs.eventtap.event.types.otherMouseDown then
        startRecording()
    else
        stopAndRoute()
    end
    return true  -- consume so the click doesn't reach the focused app
end)
mouseTap:start()

local deviceLabel = (AUDIO_DEVICE == "" and "default") or AUDIO_DEVICE
local msg = DISCOVER
    and "✓ obsidian voice (DISCOVER mode — click mouse buttons, check Console)"
    or  ("✓ obsidian voice loaded · btn " .. TARGET_BUTTON .. " · mic: " .. deviceLabel)
hs.alert.show(msg, { textSize = 14 }, 2.5)
