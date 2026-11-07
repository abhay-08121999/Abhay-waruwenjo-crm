const fs = require('fs');
const path = 'C:/Users/NEHA SAI PRIYA/Desktop/waruwenjo work/quotation template/template5.html';
const html = fs.readFileSync(path, 'utf8');

// The block to replace starts with: <table align="center" border="0" cellpadding="0" cellspacing="0" class="pc-component"...>
// after the first one which is the header.
// Let's use string operations.
const marker1 = '<table align="center" border="0" cellpadding="0" cellspacing="0" class="pc-component" role="presentation" style="width:600px;max-width:600px" width="600">\r\n         <tr>\r\n          <td border="0" cellpadding="0" cellspacing="0" class="pc-w620-spacing-0-0-0-0" role="presentation" width="100%">\r\n           <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">\r\n            <tr>\r\n             <td bgcolor="#243261"';

const parts = html.split(marker1);
if (parts.length < 2) {
    console.log("Could not find marker1");
    process.exit(1);
}

const top = parts[0];

const marker2 = '<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">\r\n               <tr>\r\n                <td align="center" class="pc-w620-spacing-0-0-20-0 pc-w620-align-center" style="padding:0 0 20px;height:auto" valign="top">';
const parts2 = html.split(marker2);
if (parts2.length < 2) {
    console.log("Could not find marker2");
    process.exit(1);
}

const bottom = marker2 + parts2[1];

const bodyBlock = `
        <table align="center" border="0" cellpadding="0" cellspacing="0" class="pc-component" role="presentation" style="width:600px;max-width:600px" width="600">
         <tr>
          <td border="0" cellpadding="0" cellspacing="0" class="pc-w620-spacing-0-0-0-0" role="presentation" width="100%">
           <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
             <td bgcolor="#ffffff" style="padding:40px;height:unset;background-color:#ffffff;font-family:'Work Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a2332;" valign="top">
              \${bodyContent}
             </td>
            </tr>
           </table>
          </td>
         </tr>
        </table>
`;

const tsCode = `export const buildWaruWenJoEmail = (bodyContent: string) => \`
${top}${bodyBlock}${bottom}\`;
`;

fs.writeFileSync('C:/Users/NEHA SAI PRIYA/Desktop/waruwenjo work/healthhub-crm_source_code-feature_quotation_changes/components/emailTemplate.ts', tsCode);
console.log('Successfully created emailTemplate.ts');
