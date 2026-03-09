!macro customUnInstall
  # Remove ClawBox config data (%APPDATA%/ClawBox/clawbox-config)
  RMDir /r "$APPDATA\${APP_FILENAME}\clawbox-config"

  # Remove OpenClaw config (~/.openclaw)
  RMDir /r "$PROFILE\.openclaw"

  # Remove OpenClaw temp logs (\tmp\openclaw)
  RMDir /r "$TEMP\..\tmp\openclaw"
  RMDir /r "C:\tmp\openclaw"
!macroend
