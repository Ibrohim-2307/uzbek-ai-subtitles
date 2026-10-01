import urllib.request
import json
import asyncio
import websockets

async def reload_panel():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8088/json") as res:
            targets = json.loads(res.read().decode())
        
        if not targets:
            print("No CEP targets found on port 8088")
            return
        
        ws_url = targets[0]["webSocketDebuggerUrl"]
        print("Connecting to:", ws_url)
        async with websockets.connect(ws_url) as ws:
            # 1. Reload JSX scripts into host environment
            eval_script = r"""
            (function() {
                try {
                    if (window.__adobe_cep__) {
                        var cs = new CSInterface();
                        var extPath = cs.getSystemPath("extension");
                        var p1 = extPath.replace(/\\/g, '/') + '/host/shared.jsx';
                        var p2 = extPath.replace(/\\/g, '/') + '/host/premiere.jsx';
                        var p3 = extPath.replace(/\\/g, '/') + '/host/aftereffects.jsx';
                        cs.evalScript('$.evalFile("' + p1 + '")', function(r1) { console.log("Reloaded shared.jsx:", r1); });
                        cs.evalScript('$.evalFile("' + p2 + '")', function(r2) { console.log("Reloaded premiere.jsx:", r2); });
                        cs.evalScript('$.evalFile("' + p3 + '")', function(r3) { console.log("Reloaded aftereffects.jsx:", r3); });
                        return "eval files dispatched";
                    }
                    return "not in CEP";
                } catch(e) {
                    return "error: " + e.message;
                }
            })()
            """
            await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": eval_script}}))
            r1 = await ws.recv()
            print("Eval response:", r1)

            # Short sleep
            await asyncio.sleep(0.3)

            # 2. Page reload
            await ws.send(json.dumps({"id": 2, "method": "Page.reload", "params": {"ignoreCache": True}}))
            r2 = await ws.recv()
            print("Reload response:", r2)
            print("CEP panel successfully reloaded!")
    except Exception as e:
        print("Reload error:", e)

if __name__ == "__main__":
    asyncio.run(reload_panel())
