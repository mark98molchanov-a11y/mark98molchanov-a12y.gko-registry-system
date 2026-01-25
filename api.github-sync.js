// api/github-sync.js
const https = require('https');

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const {
    GITHUB_TOKEN='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',
    GITHUB_REPO_OWNER = 'mark98molchanov',
    GITHUB_REPO_NAME = 'mark98molchanov-a11y'
  } = process.env;

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const GITHUB_FILE_PATH = req.query.path || 'gko_all_data_2026-01-22.json';

  if (req.method === 'GET') {
    // Загрузка файла из GitHub
    try {
      const fileContent = await getGitHubFile(
        GITHUB_REPO_OWNER,
        GITHUB_REPO_NAME,
        GITHUB_FILE_PATH,
        GITHUB_TOKEN
      );
      return res.status(200).json(fileContent);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    // Сохранение файла в GitHub
    try {
      const data = req.body;
      const result = await updateGitHubFile(
        GITHUB_REPO_OWNER,
        GITHUB_REPO_NAME,
        GITHUB_FILE_PATH,
        data,
        GITHUB_TOKEN
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// Функция для получения файла из GitHub
function getGitHubFile(owner, repo, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/contents/${path}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const file = JSON.parse(data);
          const content = Buffer.from(file.content, 'base64').toString('utf8');
          resolve(JSON.parse(content));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Функция для обновления файла в GitHub
function updateGitHubFile(owner, repo, path, content, token) {
  return new Promise((resolve, reject) => {
    // Сначала получаем текущий файл, чтобы получить sha
    getGitHubFile(owner, repo, path, token)
      .then(() => {
        // Если файл существует, получим его метаданные для sha
        const getOptions = {
          hostname: 'api.github.com',
          port: 443,
          path: `/repos/${owner}/${repo}/contents/${path}`,
          method: 'GET',
          headers: {
            'User-Agent': 'Node.js',
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        };

        https.get(getOptions, (getRes) => {
          let data = '';
          getRes.on('data', chunk => data += chunk);
          getRes.on('end', () => {
            if (getRes.statusCode === 200) {
              const fileInfo = JSON.parse(data);
              performUpdate(fileInfo.sha);
            } else {
              // Если файла нет, создаем новый
              performUpdate();
            }
          });
        }).on('error', reject);
      })
      .catch(() => {
        // Если файла нет (404), создаем новый
        performUpdate();
      });

    function performUpdate(sha = null) {
      const postData = JSON.stringify({
        message: `Update from GKO Registry System - ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        ...(sha && { sha }) // Включаем sha только если он существует
      });

      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: `/repos/${owner}/${repo}/contents/${path}`,
        method: 'PUT',
        headers: {
          'User-Agent': 'Node.js',
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      };

      const req = https.request(options, (res) => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ message: 'File updated successfully', response: JSON.parse(response) });
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode} - ${response}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    }
  });
}
