"""Local preview launcher, standard library only. No writes or uploads."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlsplit
import webbrowser,mimetypes
ROOT=Path(__file__).resolve().parent.parent
mimetypes.add_type('application/javascript','.js')
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 def do_GET(self):
  if self.headers.get('Host')!=f'127.0.0.1:{self.server.server_port}':self.send_error(403);return
  path=(ROOT/unquote(urlsplit(self.path).path).lstrip('/')).resolve()
  try:path.relative_to(ROOT)
  except ValueError:self.send_error(403);return
  super().do_GET()
 def list_directory(self,path):self.send_error(403);return None
if __name__=='__main__':
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 url=f'http://127.0.0.1:{server.server_port}/'
 print('Template: '+url,flush=True);print('Keep this window open. Stop with Ctrl+C.',flush=True)
 webbrowser.open(url)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
