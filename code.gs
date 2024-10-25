function doGet() {
  return HtmlService.createHtmlOutputFromFile('index'); // Serves the HTML file
}

function importDefectDojoReport(appName) {
  // Get the active spreadsheet
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Get the "IDdata" sheet
  const idDataSheet = spreadsheet.getSheetByName("IDdata");
  if (!idDataSheet) {
    Logger.log("IDdata sheet not found.");
    return { success: false, message: "IDdata sheet not found." };
  }

  // Get the data from the "IDdata" sheet
  const idDataRange = idDataSheet.getDataRange();
  const idDataValues = idDataRange.getValues();
  let engagementId;

  // Find the engagement ID corresponding to the selected application name
  idDataValues.forEach(row => {
    if (row[0] === appName) {
      engagementId = row[1]; // Assuming the engagement ID is in the second column
    }
  });

  // Log the engagement ID for debugging
  Logger.log("Selected application: " + appName);
  Logger.log("Engagement ID: " + engagementId);

  if (!engagementId) {
    Logger.log("Invalid application name selected.");
    return { success: false, message: "Invalid application name selected." };
  }

  // Ensure the engagementId is a string and trim whitespace
  engagementId = String(engagementId).trim();

  // Check if engagementId is valid (not empty or undefined)
  if (!engagementId) {
    Logger.log("Engagement ID is invalid or empty.");
    return { success: false, message: "Engagement ID is invalid or empty." };
  }

  // API details for POST request
  const apiUrl = `https://<your_defect_dojo_url>/api/v2/${engagementId}/reports/`; // Corrected API URL
  const apiToken = "Token <your_api_token>"; // Replace with your DefectDojo API token

  // Log the API URL for debugging
  Logger.log("API URL: " + apiUrl);

  // Define the payload for the POST request
  const payload = {
    "report_type": "JSON",        // You want the report in JSON format
    "title": `Macroscope-Report-LZ-${appName}`, // JSON report title (unchanged)
    "include_finding_notes": true, // Customize based on your needs
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

    // Create a new Google Sheet with a dynamic name
    const dateFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
    const sheetName = `Macroscope-Report-LZ-${appName}-${dateFormatted}`; // New Google Sheet name
    const sheet = SpreadsheetApp.create(sheetName);  // Create a new spreadsheet

    // Create a sheet with the name of the application
    const applicationSheet = sheet.getActiveSheet();
    applicationSheet.setName(appName); // Set internal sheet name

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
    applicationSheet.appendRow(headers);  // Adding headers to the sheet

    // Set the first row to bold
    const headerRange = applicationSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");

    let lastRow = 1; // Initialize lastRow to 1 for headers
    const reportData = jsonData.findings;  // Adjust based on actual JSON structure
    
    // Fetch the TitleData sheet to get the data for each title
    const titleDataSheet = spreadsheet.getSheetByName("TitleData"); // New sheet with title mappings
    if (!titleDataSheet) {
      Logger.log("TitleData sheet not found.");
      return { success: false, message: "TitleData sheet not found." };
    }

    const titleDataRange = titleDataSheet.getDataRange();
    const titleDataValues = titleDataRange.getValues();

    // Create a map of title to column values from TitleData sheet
    const titleMap = {};
    titleDataValues.forEach(row => {
      const title = row[0]; // Assuming the first column is the title
      titleMap[title] = {
        falsePositive: row[1] || "", 
        vulnPatchStatus: row[2] || "",
        latestVersion: row[3] || "",
        mitigations: row[4] || "",
        securityComments: row[5] || ""
      };
    });

    if (reportData) {
      reportData.forEach(function(finding) {
        // Check if the display_status is "Active"
        if (finding.display_status === "Active") {
          const title = finding.title;

          // Fetch corresponding data from the titleMap
          const titleDetails = titleMap[title] || {
            falsePositive: "",
            vulnPatchStatus: "",
            latestVersion: "",
            mitigations: "",
            securityComments: ""
          };

          const row = [
            finding.description,
            finding.file_path,
            finding.id,
            finding.mitigation,
            finding.references,
            finding.severity,
            title,
            titleDetails.falsePositive,
            titleDetails.vulnPatchStatus,
            titleDetails.latestVersion,
            titleDetails.mitigations,
            titleDetails.securityComments
          ];
          applicationSheet.appendRow(row);
          lastRow++; // Increment lastRow for each new row added
        }
      });
      Logger.log("Data import complete.");
    } else {
      Logger.log("No findings data found in the report.");
    }

    // Apply borders to the entire data range, including headers
    const range = applicationSheet.getRange(1, 1, lastRow, headers.length);
    range.setBorder(true, true, true, true, true, true);  // Set all borders

    // Enable text wrapping for the "Title" and "Security Team comments" columns
    const titleColumnRange = applicationSheet.getRange(2, 7, lastRow - 1); // "Title" is the 7th column
    const commentsColumnRange = applicationSheet.getRange(2, 12, lastRow - 1); // "Security Team comments" is the 12th column
    titleColumnRange.setWrap(true);
    commentsColumnRange.setWrap(true);

    return { success: true, message: "Report generated successfully.", sheetUrl: sheet.getUrl() };

  } catch (error) {
    Logger.log("Error fetching or processing data: " + error.message);
    return { success: false, message: error.message };
  }
}

// Function to get applications from the IDdata sheet
function getApplications() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const idDataSheet = spreadsheet.getSheetByName("IDdata");
  if (!idDataSheet) {
    Logger.log("IDdata sheet not found.");
    return [];
  }
  
  const idDataRange = idDataSheet.getDataRange();
  const idDataValues = idDataRange.getValues();
  
  // Get the first column of applications
  const applications = idDataValues.map(row => row[0]); // Assuming the application name is in the first column
  return applications;
}


