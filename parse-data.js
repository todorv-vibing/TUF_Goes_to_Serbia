const fs = require('fs');
const path = require('path');

// CSV parser that handles quoted fields with commas and newlines
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField.trim());
                if (currentRow.length > 1 || currentRow[0] !== '') {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                if (char === '\r') i++;
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
    }
    return rows;
}

// Parse Education JSON string into readable text (handles truncated JSON from CSV export)
function parseEducation(eduStr) {
    if (!eduStr || eduStr === 'Response' || eduStr === '') return '';
    // Try full JSON parse first
    try {
        const eduArray = JSON.parse(eduStr);
        if (!Array.isArray(eduArray)) return '';
        return eduArray.map(e => {
            const parts = [];
            if (e.degreeType) parts.push(e.degreeType);
            if (e.fieldOfStudy) parts.push(e.fieldOfStudy);
            if (e.institutionName) parts.push(e.institutionName);
            return parts.join(', ');
        }).filter(x => x).join(' | ');
    } catch {
        // CSV export truncates JSON - extract what we can with regex
        const institutions = [];
        const regex = /"institutionName"\s*:\s*"([^"]+)"/g;
        const degrees = /"degreeType"\s*:\s*"([^"]+)"/g;
        const fields = /"fieldOfStudy"\s*:\s*"([^"]+)"/g;

        const instMatches = [...eduStr.matchAll(/"institutionName"\s*:\s*"([^"]+)"/g)];
        const degMatches = [...eduStr.matchAll(/"degreeType"\s*:\s*"([^"]+)"/g)];
        const fieldMatches = [...eduStr.matchAll(/"fieldOfStudy"\s*:\s*"([^"]+)"/g)];

        for (let i = 0; i < Math.max(instMatches.length, degMatches.length); i++) {
            const parts = [];
            if (degMatches[i]) parts.push(degMatches[i][1]);
            if (fieldMatches[i]) parts.push(fieldMatches[i][1]);
            if (instMatches[i]) parts.push(instMatches[i][1]);
            if (parts.length) institutions.push(parts.join(', '));
        }
        return institutions.join(' | ') || '';
    }
}

// Known Katapult founder names (CSV export has empty name fields)
const katapultFounders = {
    'Tricoman Studios': 'Borislav Vesnic',
    'Softech': 'Ognjen Lukic',
    'Beyond42': 'Dusanka Ilic',
    'DeepMark': 'Slavko Kovacevic',
    'MoveRev': 'Djordje Savic'
};

// ========== FILE 1: Serbian Product Companies ==========
console.log('Parsing Serbian Product Companies...');
const file1 = fs.readFileSync(path.join(__dirname, '..', 'Downloads', 'Serbian-Founders-for-Real-Default-view-export-1770299100693.csv'), 'utf8');
const rows1 = parseCSV(file1);
const headers1 = rows1[0];

// Find column indices
const idx = {};
headers1.forEach((h, i) => { idx[h] = i; });

const serbianCompanies = [];
for (let i = 1; i < rows1.length; i++) {
    const row = rows1[i];
    if (!row || row.length < 10) continue;

    const companyType = row[idx['Company Type']] || '';
    if (companyType !== 'product_company') continue;

    const firstName = row[idx['First Name']] || '';
    const lastName = row[idx['Last Name']] || '';
    const founderName = `${firstName} ${lastName}`.trim();

    const founderScore = parseFloat(row[idx['Founder Score']]) || null;
    const productScore = parseFloat(row[idx['Product Score']]) || null;
    const marketScore = parseFloat(row[idx['Market Opportunity Score']]) || null;
    const overallScore = parseFloat(row[idx['Overall Weighted Score']]) || null;

    serbianCompanies.push({
        company_name: row[idx['Company Name']] || '',
        company_website: row[idx['Company Website']] || '',
        person_linkedin_url: row[idx['Person LinkedIn URL']] || '',
        company_linkedin_url: row[idx['Company LinkedIn URL']] || '',
        founder_name: founderName,
        founder_score: founderScore,
        product_score: productScore,
        market_opportunity_score: marketScore,
        overall_weighted_score: overallScore
    });
}

// Sort by overall score descending
serbianCompanies.sort((a, b) => (b.overall_weighted_score || 0) - (a.overall_weighted_score || 0));
fs.writeFileSync(path.join(__dirname, 'serbian_companies.json'), JSON.stringify(serbianCompanies, null, 2));
console.log(`  → ${serbianCompanies.length} product companies saved`);

// ========== FILE 2: Serbian Founders ==========
console.log('Parsing Serbian Founders...');
const file2 = fs.readFileSync(path.join(__dirname, '..', 'Downloads', 'Serbian-Founders-for-Real-Default-view-export-1770294951389.csv'), 'utf8');
const rows2 = parseCSV(file2);
const headers2 = rows2[0];

const idx2 = {};
headers2.forEach((h, i) => { idx2[h] = i; });

const serbianFounders = [];
for (let i = 1; i < rows2.length; i++) {
    const row = rows2[i];
    if (!row || row.length < 4) continue;

    const fullName = row[idx2['Full Name']] || '';
    if (!fullName) continue;

    const linkedin = row[idx2['LinkedIn']] || '';
    const founderProfile = row[idx2['Founder Profile']] || '';
    const education = row[idx2['Education']] || '';
    const scoreRationale = row[idx2['Founder Score & Rationale']] || '';
    const founderScore = parseFloat(row[idx2['Founder Score']]) || null;

    // Use the profile text if it's not just "Response", otherwise use education
    let profileText = '';
    if (founderProfile && founderProfile !== 'Response' && founderProfile.length > 20) {
        profileText = founderProfile;
    } else if (scoreRationale && scoreRationale !== 'Response' && scoreRationale.length > 20) {
        profileText = scoreRationale;
    }

    const educationText = parseEducation(education);

    serbianFounders.push({
        full_name: fullName,
        linkedin_url: linkedin,
        founder_profile: profileText,
        education: educationText,
        founder_score: founderScore
    });
}

// Sort by founder score descending
serbianFounders.sort((a, b) => (b.founder_score || 0) - (a.founder_score || 0));
fs.writeFileSync(path.join(__dirname, 'serbian_founders.json'), JSON.stringify(serbianFounders, null, 2));
console.log(`  → ${serbianFounders.length} founders saved`);

// ========== FILE 3: Katapult Accelerator ==========
console.log('Parsing Katapult Accelerator...');
const file3 = fs.readFileSync(path.join(__dirname, '..', 'Downloads', 'Katapult-Default-view-export-1770299010351.csv'), 'utf8');
const rows3 = parseCSV(file3);
const headers3 = rows3[0];

const idx3 = {};
headers3.forEach((h, i) => { idx3[h] = i; });

const katapult = [];
for (let i = 1; i < rows3.length; i++) {
    const row = rows3[i];
    if (!row || row.length < 10) continue;

    const firstName = row[idx3['First Name']] || '';
    const lastName = row[idx3['Last Name']] || '';
    let founderName = `${firstName} ${lastName}`.trim();
    const companyName = row[idx3['Company Name']] || '';
    if (!founderName && katapultFounders[companyName]) {
        founderName = katapultFounders[companyName];
    }

    const founderScore = parseFloat(row[idx3['Founder Score']]) || null;
    const productScore = parseFloat(row[idx3['Product Score']]) || null;
    const marketScore = parseFloat(row[idx3['Market Opportunity Score']]) || null;
    const overallScore = parseFloat(row[idx3['Overall Weighted Score']]) || null;

    katapult.push({
        company_name: row[idx3['Company Name']] || '',
        company_website: row[idx3['Company Website']] || '',
        person_linkedin_url: row[idx3['Person LinkedIn URL']] || '',
        company_linkedin_url: row[idx3['Company LinkedIn URL']] || '',
        founder_name: founderName,
        founder_score: founderScore,
        product_score: productScore,
        market_opportunity_score: marketScore,
        overall_weighted_score: overallScore
    });
}

katapult.sort((a, b) => (b.overall_weighted_score || 0) - (a.overall_weighted_score || 0));
fs.writeFileSync(path.join(__dirname, 'katapult.json'), JSON.stringify(katapult, null, 2));
console.log(`  → ${katapult.length} companies saved`);

console.log('\nDone! Files created:');
console.log('  serbian_companies.json');
console.log('  serbian_founders.json');
console.log('  katapult.json');
