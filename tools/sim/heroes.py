"""Потери HP по героям и стадиям из файла забегов tools/sim/sim.js.

usage: python3 tools/sim/heroes.py sim_d1.json
Колонки: число боёв, средняя потеря HP в долях максимума, ходов на бой, урон героя за ход.
"""
import json, sys, collections
R=json.load(open(sys.argv[1]))
print('cls        win  | stage1: fight(n, hp-, turns, dpt) elite boss | stage2: fight elite boss | final')
for cls in ['lamp','courier','guard','stoker','baker','grinder','shepherd','herbalist']:
    rs=[r for r in R if r['cls']==cls]
    B=collections.defaultdict(lambda:[0,0,0,0])
    for r in rs:
        for f in r['fights']:
            st = 0 if f['step']<25 else 1 if f['step']<50 else 2
            b=B[(st,f['tier'])]; b[0]+=1; b[1]+=(f['hp0']-f['hp1'])/f['max']; b[2]+=f['turns']; b[3]+=f['ehp']
    def g(k):
        v=B.get(k)
        return f"{v[0]:3} {100*v[1]/v[0]:4.0f}% {v[2]/v[0]:4.1f}t {v[3]/max(1,v[2]):4.1f}" if v else '  -              '
    print(f"{cls:10} {sum(r['win'] for r in rs):2}/{len(rs)} | {g((0,'fight'))} | {g((0,'elite'))} | {g((0,'boss'))} || {g((1,'fight'))} | {g((1,'elite'))} | {g((1,'boss'))} || {g((2,'boss'))}")
    print('           deaths', sorted(r['step'] for r in rs if not r['win']), 'relics@end', round(sum(r['relics'] for r in rs)/len(rs),1))
