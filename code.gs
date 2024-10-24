function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getApplications() {
  const idDataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("IDdata");
  const data = idDataSheet.getDataRange().getValues();

  Logger.log(data); // Log the retrieved data
  
  return data.map(row => row[0]); // Assuming application names are in the first column
}

function importDefectDojoReport(selectedApp) {
  // API details for POST request
  const apiUrl = "https://<your_defect_dojo_url>/api/v2/reports/";  // Replace with your API URL for report generation
  const apiToken = "Token <your_api_token>";  // Replace with your DefectDojo API token

  // Fetch the engagement ID based on the selected application
  const idDataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("IDdata");
  const data = idDataSheet.getDataRange().getValues();
  const engagementId = data.find(row => row[0] === selectedApp)[1]; // Get engagement ID for the selected app

  // Define the payload for the POST request
  const payload = {
    "engagement": engagementId,  // Use the retrieved engagement ID
    "report_type": "JSON",          // You want the report in JSON format
    "title": "Engagement Report",
    "include_finding_notes": true,  // Customize based on your needs
    "include_finding_images": false,
    "include_finding_request_response": false
  };

  // Set up the options for the POST request
  const options = {
    method: "POST",
    headers: {
      "Authorization": apiToken,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  };

  try {
    // Make the POST request to generate the report
    const response = UrlFetchApp.fetch(apiUrl, options);
    const jsonData = JSON.parse(response.getContentText());

    // Check the structure of the response to ensure it's correct
    Logger.log(jsonData);

    // Create a new Google Sheet
    const sheetName = "EngagementReport_" + new Date().toISOString().slice(0, 10); // Creates a unique sheet name with date
    const sheet = SpreadsheetApp.create(sheetName);  // Create a new spreadsheet

    // Get the active sheet in the newly created spreadsheet
    const sheetData = sheet.getActiveSheet(); 

    // Parse JSON data and insert it into the Google Sheet
    const headers = [
      "Description", 
      "File Path", 
      "ID", 
      "Mitigation", 
      "References", 
      "Severity", 
      "Title", 
      "False Positive",       // New blank column
      "Vuln_Patch_Status",    // New blank column
      "Latest Version",       // New blank column
      "Mitigations",          // New blank column
      "Security Team comments" // New blank column
    ];  
    sheetData.appendRow(headers);  // Adding headers to the sheet

    // Set the first row to bold
    const headerRange = sheetData.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");

    // Prepare to apply borders to all cells after data has been added
    let lastRow = 1; // Initialize lastRow to 1 for headers
    const reportData = jsonData.findings;  // Adjust based on actual JSON structure
    if (reportData) {
      reportData.forEach(function(finding) {
        // Check if the display_status is "Active"
        if (finding.display_status === "Active") {
          // Extract relevant data from each finding (adjust fields to match actual structure)
          const row = [
            finding.description,
            finding.file_path,
            finding.id,
            finding.mitigation,
            finding.references,
            finding.severity,
            finding.title,
            "", // Blank for "False Positive"
            "", // Blank for "Vuln_Patch_Status"
            "", // Blank for "Latest Version"
            "", // Blank for "Mitigations"
            ""  // Blank for "Security Team comments"
          ];
          sheetData.appendRow(row);
          lastRow++; // Increment lastRow for each new row added
        }
      });
      Logger.log("Data import complete.");
    } else {
      Logger.log("No findings data found in the report.");
    }

    // Apply borders to the entire data range, including headers
    const range = sheetData.getRange(1, 1, lastRow, headers.length);
    range.setBorder(true, true, true, true, true, true);  // Set all borders

    // Enable text wrapping for the "Title" and "Security Team comments" columns
    const titleColumnRange = sheetData.getRange(2, 7, lastRow - 1); // "Title" is the 7th column
    const commentsColumnRange = sheetData.getRange(2, 12, lastRow - 1); // "Security Team comments" is the 12th column
    titleColumnRange.setWrap(true);
    commentsColumnRange.setWrap(true);

    // Return the URL of the new sheet
    return { success: true, sheetUrl: sheet.getUrl() };

  } catch (error) {
    Logger.log("Error fetching or processing data: " + error.message);
    return { success: false, message: error.message };
  }
}



