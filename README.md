# DoeVida modularizado

Estrutura preparada para deploy estático na Netlify.

## Estrutura

```txt
index.html
css/styles.css
js/app.js
js/state.js
js/data/campaigns.js
assets/
```

## Como rodar localmente

Use uma extensão como Live Server no VS Code, ou rode:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Deploy na Netlify

Publique a pasta inteira `doevida_modularizado`. O arquivo de entrada é `index.html`.

# TODO
## 1 - Guia Campanhas:
    Deveria ser tanto para empresas que querem ajudar a ter um camapanha (escola, facul, empresa) quanto para clinicas e hospitais que querem divulgar sua campanha
## 2 - Login:
    validacao minimia de email e senha
