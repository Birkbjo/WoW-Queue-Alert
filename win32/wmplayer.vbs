Dim oPlayer
Set oPlayer = CreateObject("WMPlayer.OCX")
Set fso = CreateObject("Scripting.FileSystemObject")

oPlayer.URL = WScript.arguments(0)
If fso.FileExists(oPlayer.URL) <> True Then
  WScript.Quit -1
end If
oPlayer.controls.play 

While oPlayer.playState <> 1 ' 1 = Stopped
  WScript.Sleep 100
Wend

' Release the audio file
oPlayer.close
WScript.Quit 0
