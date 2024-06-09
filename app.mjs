import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());
app.use(bodyParser.json());

async function runLighthouse(url) {
    const browser = await puppeteer.launch({ headless: true });
    const port = new URL(browser.wsEndpoint()).port;

    const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['performance'],
        port: port,
    };

    const runnerResult = await lighthouse(url, options);

    await browser.close();

    return runnerResult.lhr;
}

app.post('/analyze', async (req, res) => {
    const url = req.body.url;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const lighthouseResult = await runLighthouse(url);
        const fmp = lighthouseResult.audits['first-meaningful-paint'].displayValue;
        const blockingResources = lighthouseResult.audits['render-blocking-resources'].details.items;

        const results = {
            first_meaningful_paint: fmp,
            blocking_resources: blockingResources.map(resource => ({
                url: resource.url,
                total_bytes: resource.totalBytes
            }))
        };

        res.json(results);
    } catch (error) {
        console.error('Error running Lighthouse:', error);
        res.status(500).json({ error: 'Error running Lighthouse' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
