import urllib.request
import json
import asyncio
import websockets

async def check():
    with urllib.request.urlopen("http://127.0.0.1:8088/json") as res:
        targets = json.loads(res.read().decode())
    ws_url = targets[0]["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url) as ws:
        # Check elements and objects
        test_js = """
        ({
            title: document.title,
            hasEditor: typeof window.SubtitleEditor !== 'undefined',
            hasBridge: typeof window.HostBridge !== 'undefined',
            hasAPI: typeof window.SubtitleAPI !== 'undefined',
            hasWaveformCanvas: !!document.getElementById('waveformCanvas'),
            hasRealignBtn: !!document.getElementById('btnRealignSelected'),
            hasTapSyncBtn: !!document.getElementById('btnToggleTapSync'),
            hasModelSelect: !!document.getElementById('transcribeModelSelect'),
            hasPauseHideCheck: !!document.getElementById('checkPauseHideText'),
            hasCharRevealCheck: !!document.getElementById('checkCharReveal'),
            hostApp: window.HostBridge ? window.HostBridge.hostApp : "none"
        })
        """
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": test_js, "returnByValue": True}}))
        resp = await ws.recv()
        data = json.loads(resp)
        print("Raw response:", resp)
        print("Verification result:", json.dumps(data.get("result", {}).get("result", {}).get("value", {}), indent=2))

if __name__ == "__main__":
    asyncio.run(check())
