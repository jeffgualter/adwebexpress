const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🔹 Página principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

// 🔹 Conectar ao banco de dados SQLite
const db = new sqlite3.Database('./campaigns.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados', err);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite');
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            trackingLink TEXT NOT NULL,
            percentage INTEGER NOT NULL
        )`);
    }
});

// 🔹 Rota para listar campanhas
app.get('/campaigns', (req, res) => {
    db.all('SELECT * FROM campaigns', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// 🔹 Rota para adicionar uma nova campanha
app.post('/campaigns', (req, res) => {
    const { name, trackingLink, percentage } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-'); // Criar slug

    db.run(
        "INSERT INTO campaigns (name, trackingLink, percentage) VALUES (?, ?, ?)",
        [name, trackingLink, percentage],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                const campaignId = this.lastID;
                console.log(`✅ Campanha "${name}" cadastrada com sucesso!`);
                res.json({ id: campaignId, name, trackingLink, percentage, slug });
            }
        }
    );
});

// 🔹 Rota para gerar scripts dinamicamente
app.get('/scripts/:scriptName', (req, res) => {
    const campaignSlug = path.basename(req.params.scriptName, '.js'); // Remove .js para pegar o nome real da campanha

    db.get("SELECT trackingLink FROM campaigns WHERE name = ?", [campaignSlug], (err, row) => {
        if (err || !row) {
            return res.status(404).send("// Script não encontrado");
        }

        // Gera um script dinâmico para redirecionamento para o tracking link
        const scriptContent = `
            (function() {
                setTimeout(function() {
                    window.location.href = "/redirect?url=${encodeURIComponent(row.trackingLink)}";
                }, 2000); // Delay de 2 segundos antes do redirecionamento
            })();
        `;

        res.setHeader("Content-Type", "application/javascript");
        res.send(scriptContent);
    });
});

// 🔹 Rota para redirecionar e camuflar os parâmetros da URL final
app.get('/redirect', (req, res) => {
    const trackingUrl = req.query.url;

    if (!trackingUrl) {
        return res.status(400).send("❌ URL inválida!");
    }

    // Extrai apenas o domínio e caminho base da URL final, removendo parâmetros
    const parsedUrl = new URL(trackingUrl);
    const cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;

    console.log(`🔁 Redirecionando de: ${trackingUrl} para ${cleanUrl}`);

    res.redirect(302, cleanUrl);
});

// 🔹 Iniciar o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
