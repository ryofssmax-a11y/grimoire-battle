# Synthetic book covers + fake "camera photos" (cover on a table, slight perspective). Original art only.
import json, random, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SANS='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; SERIF='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
import os
if not os.path.exists(SERIF): SERIF=SANS
COVERS=[
 ('炎の魔術師','火','#b3261e','#fff4e0',SANS,'h','赤城 遥'),
 ('深海の記憶','水','#0e2a5c','#cfe6ff',SERIF,'h','青木 澪'),
 ('風の旅人','風','#cfe8d6','#1d3b2a',SANS,'h','空野 翔'),
 ('夜明けの星','光','#1b1030','#f2cf6a',SERIF,'h','星野 明'),
 ('The Dark Forest','闇','#16301d','#f0f0f0',SANS,'h','J. Rowan'),
 ('山の音','土','#e9dcc0','#2a1a0a',SERIF,'v','川端 某'),
]
def cover(t,bg,fg,font,mode,author,seed):
    random.seed(seed); W,H=600,860; im=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(im)
    for i in range(6): # decoration
        r=random.randint(60,220); x=random.randint(0,W); y=random.randint(int(H*.45),H)
        d.ellipse([x-r,y-r,x+r,y+r],outline=fg,width=3)
    d.rectangle([24,24,W-24,H-24],outline=fg,width=4)
    if mode=='h':
        size=96 if len(t)<=5 else 70
        f=ImageFont.truetype(font,size); bw=d.textlength(t,font=f)
        if bw>W-80: f=ImageFont.truetype(font,int(size*(W-80)/bw)); bw=d.textlength(t,font=f)
        d.text(((W-bw)/2,150),t,font=f,fill=fg)
    else:
        f=ImageFont.truetype(font,110)
        for i,ch in enumerate(t): d.text((W-200,110+i*125),ch,font=f,fill=fg)
    fa=ImageFont.truetype(SANS,34); aw=d.textlength(author,font=fa); d.text(((W-aw)/2,H-110),author,font=fa,fill=fg)
    return im
def coeffs(dst,src):
    A=[];B=[]
    for (x,y),(u,v) in zip(dst,src):
        A.append([x,y,1,0,0,0,-u*x,-u*y]);B.append(u);A.append([0,0,0,x,y,1,-v*x,-v*y]);B.append(v)
    return np.linalg.solve(np.array(A,float),np.array(B,float)).tolist()
meta=[]
for i,(t,el,bg,fg,font,mode,au) in enumerate(COVERS):
    c=cover(t,bg,fg,font,mode,au,i); c.save(f'covers/cover{i+1}.png')
    random.seed(100+i); PW,PH=1280,960
    base=np.random.default_rng(i).normal(0,9,(PH,PW,1))+np.array([150,120,90])  # table
    for k in range(0,PW,40): base[:,k:k+3]-=12
    photo=Image.fromarray(np.clip(base,0,255).astype('uint8'))
    cx,cy,h=PW/2+random.uniform(-60,60),PH/2+random.uniform(-30,30),random.uniform(720,820); w=h*600/860
    j=lambda: random.uniform(-35,35)
    dst=[(cx-w/2+j(),cy-h/2+j()),(cx+w/2+j(),cy-h/2+j()),(cx+w/2+j(),cy+h/2+j()),(cx-w/2+j(),cy+h/2+j())]
    src=[(0,0),(600,0),(600,860),(0,860)]
    warped=c.transform((PW,PH),Image.PERSPECTIVE,coeffs(dst,src),Image.BICUBIC)
    mask=Image.new('L',(600,860),255).transform((PW,PH),Image.PERSPECTIVE,coeffs(dst,src),Image.BILINEAR)
    sh=mask.filter(ImageFilter.GaussianBlur(14)); photo.paste((40,25,15),(14,18),sh) if False else None
    photo.paste(warped,(0,0),mask)
    photo=photo.filter(ImageFilter.GaussianBlur(0.8))
    arr=np.array(photo).astype(float)*np.linspace(1.05,0.85,PW)[None,:,None]  # lighting falloff
    arr+=np.random.default_rng(50+i).normal(0,4,arr.shape)
    Image.fromarray(np.clip(arr,0,255).astype('uint8')).save(f'covers/photo{i+1}.jpg',quality=88)
    meta.append({'file':f'photo{i+1}.jpg','title':t,'expectElement':el,'mode':mode,'quad':dst})
json.dump(meta,open('covers/covers.json','w'),ensure_ascii=False,indent=1)
print('ok')
