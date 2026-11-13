from pathlib import Path
import cv2, numpy as np, zipfile, hashlib, json, sys
root=Path(sys.argv[1])
detector=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
results=[]
for filename in ['sample.zip','full.zip']:
 with zipfile.ZipFile(root/filename) as archive:
  assert archive.testzip() is None
  found=[]; missing=[]; hashes=set()
  for name in archive.namelist():
   assert name.endswith('.jpg') and '/' not in name
   raw=archive.read(name);image=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
   assert image.shape==(512,512,3), (name,image.shape)
   hashes.add(hashlib.sha256(raw).hexdigest())
   faces=detector.detectMultiScale(cv2.cvtColor(image,cv2.COLOR_BGR2GRAY),scaleFactor=1.1,minNeighbors=5,minSize=(100,100))
   (found if len(faces)==1 else missing).append(name)
  result={'zip':filename,'images':len(archive.namelist()),'one_face':len(found),'other_face_counts':missing,'unique_jpegs':len(hashes)}
  results.append(result)
print(json.dumps(results,ensure_ascii=False,indent=2))
(root/'face-check.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
assert all(not r['other_face_counts'] for r in results)
