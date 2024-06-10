import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';

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

    // Save the full report
    const reportJson = runnerResult.report;
    await fs.writeFile('lighthouse-report.json', reportJson);

    return JSON.parse(reportJson);
}

app.post('/analyze', async (req, res) => {
    const url = req.body.url;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const runnerResult = await runLighthouse(url);

        // Extract relevant data from Lighthouse result
        const fmp = runnerResult.audits['first-meaningful-paint'].displayValue;
        const blockingResources = runnerResult.audits['render-blocking-resources'].details.items;

        // Construct recommendations based on the analysis
        const recommendations = blockingResources.map(resource => ({
            url: resource.url,
            total_bytes: resource.totalBytes,
        }));

        res.json({
            first_meaningful_paint: fmp,
            blocking_resources: recommendations,
        });
    } catch (error) {
        res.status(500).json({ error: 'Error running Lighthouse', details: error.message });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


