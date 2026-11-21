import json,sys,math
rail,country,pa,out=sys.argv[1:5]
def dp(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy) or 1e-12
    dmax,idx=0,0
    for i in range(1,len(pts)-1):
        p=pts[i]; d=abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L if (dx or dy) else math.hypot(p[0]-a[0],p[1]-a[1])
        if d>dmax: dmax,idx=d,i
    if dmax>eps: return dp(pts[:idx+1],eps)[:-1]+dp(pts[idx:],eps)
    return [a,b]
def simp(ring,eps):
    import sys; sys.setrecursionlimit(100000)
    r=dp(ring,eps); return [[round(x,5),round(y,5)] for x,y in r]
def ring_area(r): return 0.5*abs(sum(r[i][0]*r[i-1][1]-r[i-1][0]*r[i][1] for i in range(len(r))))
def polys(g): return g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
land=[]
for poly in polys(json.load(open(country))['features'][0]['geometry']):
    if ring_area(poly[0])>2e-6: land.append(simp(poly[0],0.00015))
areas=[]
for f in json.load(open(pa))['features']:
    ps=[simp(p[0],0.0003) for p in polys(f['geometry']) if ring_area(p[0])>1e-6]
    big=max(polys(f['geometry']),key=lambda p:ring_area(p[0]))[0]
    A=0;cx=0;cy=0
    for i in range(len(big)):
        x0,y0=big[i-1];x1,y1=big[i];c=x0*y1-x1*y0;A+=c;cx+=(x0+x1)*c;cy+=(y0+y1)*c
    A/=2; areas.append({'n':f['properties']['name'].title(),'p':ps,'c':[round(cx/(6*A),5),round(cy/(6*A),5)]})
d=json.load(open(rail))['features']
colors={'orangered':'#D42E12','mediumseagreen':'#009645','darkmagenta':'#9900AA','orange':'#FA9E0D','darkslateblue':'#005EC4','saddlebrown':'#9D5B25','gray':'#748477'}
lines=[]
for f in d:
    g=f['geometry']
    if 'Line' not in g['type'] or 'mrt' not in f['properties']['network']: continue
    segs=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    lines.append({'n':f['properties']['name'],'c':colors.get(f['properties']['line_color'],'#888'),'s':[simp(s,0.0001) for s in segs]})
st=[{'n':f['properties']['name'],'zh':f['properties'].get('name_zh-Hans',''),'code':f['properties']['station_codes'],'c':[round(v,5) for v in f['geometry']['coordinates']]}
    for f in d if f['geometry']['type']=='Point' and f['properties'].get('stop_type')=='station' and 'mrt' in f['properties']['network']]
json.dump({'land':land,'areas':areas,'lines':lines,'st':st},open(out,'w'),ensure_ascii=False,separators=(',',':'))
print(len(land),len(areas),len(lines),len(st))
