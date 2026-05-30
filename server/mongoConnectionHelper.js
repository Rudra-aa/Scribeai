const https = require('https');

/**
 * Robust DNS query trying multiple DNS-over-HTTPS providers sequentially.
 */
async function getDnsRecords(name, type) {
    const providers = [
        {
            name: 'Cloudflare IP (1.1.1.1)',
            url: `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
            headers: { 'accept': 'application/dns-json' }
        },
        {
            name: 'Cloudflare IP (1.0.0.1)',
            url: `https://1.0.0.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
            headers: { 'accept': 'application/dns-json' }
        },
        {
            name: 'Google Host (dns.google)',
            url: `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`
        },
        {
            name: 'Cloudflare Host (cloudflare-dns.com)',
            url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
            headers: { 'accept': 'application/dns-json' }
        }
    ];

    let lastError = null;
    for (const provider of providers) {
        try {
            const data = await new Promise((resolve, reject) => {
                const options = {
                    headers: provider.headers || {},
                    timeout: 4000
                };
                
                https.get(provider.url, options, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                reject(new Error(`HTTP ${res.statusCode}`));
                                return;
                            }
                            const json = JSON.parse(body);
                            resolve(json);
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });

            if (data && data.Answer && data.Answer.length > 0) {
                return data.Answer;
            }
        } catch (err) {
            lastError = err;
            // Silent fallback to next provider
        }
    }

    throw lastError || new Error(`Failed to resolve ${name} (${type}) via all DoH providers.`);
}

/**
 * Resolves a mongodb+srv:// URI into a standard mongodb:// URI using Google/Cloudflare DoH.
 * Bypasses local ISP/router DNS SRV blocks.
 */
async function resolveMongoUri(srvUri) {
    if (!srvUri || !srvUri.startsWith('mongodb+srv://')) {
        return srvUri;
    }
    
    try {
        console.log('Resolving mongodb+srv URI via robust multi-provider DNS-over-HTTPS resolver...');
        
        // Format: mongodb+srv://<user>:<password>@<host>/<database>?<options>
        const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/);
        if (!match) {
            console.warn('Unable to parse mongodb+srv URI structure, using original.');
            return srvUri;
        }
        
        const [_, username, password, srvHost, dbName, srvOptions] = match;
        
        // 1. Fetch SRV records for the cluster nodes
        const srvRecordName = `_mongodb._tcp.${srvHost}`;
        const srvAnswers = await getDnsRecords(srvRecordName, 'SRV');
        if (srvAnswers.length === 0) {
            throw new Error(`No SRV records found for ${srvRecordName}`);
        }
        
        const hosts = srvAnswers.map(ans => {
            const parts = ans.data.trim().split(/\s+/);
            if (parts.length < 4) return null;
            const port = parts[2];
            let target = parts[3];
            if (target.endsWith('.')) {
                target = target.slice(0, -1);
            }
            return `${target}:${port}`;
        }).filter(Boolean);
        
        if (hosts.length === 0) {
            throw new Error('Failed to parse hosts from SRV records');
        }
        
        // 2. Fetch TXT records for authentication and replicaSet details
        const txtAnswers = await getDnsRecords(srvHost, 'TXT');
        let txtOptions = '';
        if (txtAnswers.length > 0) {
            const rawData = txtAnswers[0].data;
            txtOptions = rawData.replace(/^"|"$/g, ''); // Strip outer quotes if present
        }
        
        // 3. Reconstruct standard mongodb:// connection string
        // Note: MongoDB Atlas requires ssl=true
        let resolvedUri = `mongodb://${username}:${password}@${hosts.join(',')}/${dbName || ''}?ssl=true`;
        
        if (txtOptions) {
            resolvedUri += `&${txtOptions}`;
        }
        
        // 4. Append any original query options (e.g. retryWrites) if not already set
        if (srvOptions) {
            const origParams = new URLSearchParams(srvOptions);
            const resolvedParams = new URLSearchParams(txtOptions || '');
            for (const [key, val] of origParams.entries()) {
                if (!resolvedParams.has(key)) {
                    resolvedUri += `&${key}=${val}`;
                }
            }
        }
        
        console.log('Successfully resolved to standard connection string:', resolvedUri.replace(/:[^:]+@/, ':****@'));
        return resolvedUri;
    } catch (err) {
        console.error('DNS-over-HTTPS resolution failed:', err.message);
        console.warn('Falling back to original connection URI.');
        return srvUri;
    }
}

module.exports = {
    resolveMongoUri
};
