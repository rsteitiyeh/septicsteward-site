#!/usr/bin/env python3
"""Convert SepticSteward.dc.html (design-canvas export) -> static/index.html + static/app.js"""
import re, html as H

src = open('/tmp/design/SepticSteward.dc.html').read()

# 1. Extract <style> block from helmet
style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
# 2. Extract body inner between </helmet> and the data-dc-script
body = src.split('</helmet>',1)[1]
body = body.split('<script type="text/x-dc"',1)[0]

# 3. Drop ad-placeholder + anchor-ad sc-if blocks entirely (no ads at launch, G3)
def drop_scif(text, marker):
    out, i = [], 0
    while True:
        j = text.find('<sc-if', i)
        if j < 0: out.append(text[i:]); break
        k = text.find('</sc-if>', j) + len('</sc-if>')
        block = text[j:k]
        out.append(text[i:j])
        if marker not in block:
            out.append(block)  # keep, handled later
        i = k
    return ''.join(out)
body = drop_scif(body, 'adsOn')
body = drop_scif(body, 'anchorOn')

# 4. Remaining sc-if (email done/notDone states) -> divs with data-if attr for app.js
body = re.sub(r'<sc-if value="\{\{ (\w+) \}\}"[^>]*>', r'<div data-if="\1">', body)
body = body.replace('</sc-if>', '</div>')

# 5. style-hover / style-active -> generated classes
hover_map = {}
def hoverize(m):
    tag = m.group(0)
    hov = re.search(r'\sstyle-hover="([^"]*)"', tag)
    act = re.search(r'\sstyle-active="([^"]*)"', tag)
    key = ((hov.group(1) if hov else ''), (act.group(1) if act else ''))
    if key not in hover_map:
        hover_map[key] = f"hv{len(hover_map)}"
    cls = hover_map[key]
    tag = re.sub(r'\sstyle-hover="[^"]*"', '', tag)
    tag = re.sub(r'\sstyle-active="[^"]*"', '', tag)
    if 'class="' in tag:
        tag = tag.replace('class="', f'class="{cls} ', 1)
    else:
        tag = tag[:-1] + f' class="{cls}">'
    return tag
body = re.sub(r'<[^>]*style-hover[^>]*>', hoverize, body)
hover_css = '\n'.join(
    (f".{cls}:hover{{{h}}}" if h else '') + (f".{cls}:active{{{a}}}" if a else '')
    for (h,a),cls in hover_map.items())

# 6. Event bindings {{ handler }} -> data-on attributes
body = re.sub(r'onClick="\{\{ (\w+) \}\}"', r'data-click="\1"', body)
body = re.sub(r'onChange="\{\{ (\w+) \}\}"', r'data-change="\1"', body)
body = re.sub(r'onSubmit="\{\{ (\w+) \}\}"', r'data-submit="\1"', body)
body = re.sub(r'onInput="\{\{ (\w+) \}\}"', r'data-input="\1"', body)

# 7. Value/text bindings -> data-bind spans or attrs
body = re.sub(r'value="\{\{ (\w+) \}\}"', r'data-value="\1"', body)
body = re.sub(r'checked="\{\{ (\w+) \}\}"', r'data-checked="\1"', body)
body = re.sub(r'ref="\{\{ (\w+) \}\}"', r'data-ref="\1"', body)
body = re.sub(r'aria-expanded="\{\{ (\w+) \}\}"', r'data-aria-expanded="\1"', body)
# 6.5 bindings inside attribute values (style props, svg attrs)
def attr_bind(m):
    attr, val = m.group(1), m.group(2)
    if attr == 'style':
        decls = [d for d in val.split(';') if d.strip()]
        keep, binds = [], []
        for d in decls:
            if '{{' in d:
                prop, _, v = d.partition(':')
                var = re.search(r'\{\{ (\w+) \}\}', v).group(1)
                binds.append(f"{prop.strip()}:{var}")
            else:
                keep.append(d)
        out = f'style="{";".join(keep)}"' if keep else ''
        if binds:
            out += f' data-sbind="{";".join(binds)}"'
        return out
    var = re.search(r'\{\{ (\w+) \}\}', val).group(1)
    return f'data-abind-{attr.lower()}="{var}"'
body = re.sub(r'([\w-]+)="([^"]*\{\{[^"]*)"', attr_bind, body)
# text bindings
body = re.sub(r'\{\{ (\w+) \}\}', r'<span data-bind="\1"></span>', body)

# brand tokens
body = body.replace('{{AUTHOR_NAME}}','Rami Steitieh').replace('{{AUTHOR_BIO}}','Building online since 1997. The Trilot team researches, builds, and tests every tool and guide on this site.').replace('{{LEGAL_ENTITY_NAME}}','Trilot LLC')

# 8. Footer links -> real pages (match by label, order-independent)
import re as _re
def fixlink(m):
    href = {'Privacy Policy':'/privacy/','Affiliate Disclosure':'/affiliate-disclosure/','Terms of Use':'/terms/'}[m.group(2)]
    return m.group(1).replace('href="#"', f'href="{href}"') + m.group(2)
body = _re.sub(r'(<a href="#"[^>]*>)(Privacy Policy|Affiliate Disclosure|Terms of Use)', fixlink, body)
body = body.replace('<span data-bind="LEGAL_ENTITY_NAME"></span>','Trilot LLC').replace('{{LEGAL_ENTITY_NAME}}','Trilot LLC')

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Septic Tank Maintenance, Made Simple | SepticSteward</title>
<meta name="description" content="Plain-English septic tank maintenance for homeowners: how often to pump (typically every 3-5 years), real pump-out costs, what never to flush, plus a free printable maintenance schedule.">
<link rel="canonical" href="https://septicsteward.com/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..800;1,400&family=Young+Serif&display=swap" rel="stylesheet">
<style>
{style}
{hover_css}
[data-if]{{display:none}}
[data-if].on{{display:block}}
</style>
</head>
<body>
{body}
<script src="/app.js" defer></script>
</body>
</html>"""
open('/tmp/site/static/index.html','w').write(page)
print("index.html written:", len(page), "bytes | hover classes:", len(hover_map))
print("leftover mustache:", len(re.findall(r'\{\{', page)))
