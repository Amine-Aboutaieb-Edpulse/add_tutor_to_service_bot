const puppeteer = require("puppeteer");
// const fs = require("fs").promises;

const getWsContext = async () => {
  let response = await fetch("http://127.0.0.1:9222/json/version");
  let jsonResponse = await response.json();
  return jsonResponse["webSocketDebuggerUrl"] ?? null;
};

const waitNSeconds = async (seconds) => {
  console.log(`Pausing for ${seconds} seconds ...`);
  let millis = seconds * 1000;
  await new Promise((r) => setTimeout(r, millis));
};

const fetchTutorById = async (tutorId) => {
  let response = await fetch(`https://secure.tutorcruncher.com/api/contractors/${tutorId}/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "token b4e57c43ac08ca011fe75b5097da9a2ab261a235",
    },
  });
  let jsonResponse = await response.json();

  return jsonResponse;
};

const getDataFromSupabase = async () => {
  let response = await fetch(`https://lgshxjbxultdbfbgallu.supabase.co/rest/v1/matching_db?archived=eq.not_matched`, {
    method: "GET",
    headers: {
      apikey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnc2h4amJ4dWx0ZGJmYmdhbGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NTQzODIsImV4cCI6MjA1MjQzMDM4Mn0.iHhBr4aIg3qSWthwEkZesc4D3TN7lAtGUhf9tXHDmeM",
    },
  });
  return response.json();
};

const goToPageAndAddTutorToService = async (pptrPage, serviceId, tutorLastName, tutorFirstName) => {
  try {
    // Construct the full name
    const tutorFullName = `${tutorFirstName} ${tutorLastName}`.trim();

    // Navigate to the page
    await pptrPage.goto(`https://app.tutorax.com/cal/service/contractors/${serviceId}/add/`);

    // Interact with the page
    await pptrPage.waitForSelector("span.selection");
    await pptrPage.click("span.selection");

    await pptrPage.waitForSelector(".select2-search__field");
    await pptrPage.type(".select2-search__field", tutorFullName, { delay: 0 });

    // Wait for search result and select the option
    await pptrPage.waitForSelector(".select2-results__option");
    await pptrPage.click(".select2-results__option");

    // Submit the form
    await pptrPage.waitForSelector("input#form-submit");
    await pptrPage.click("input#form-submit");

    // Return success status
    return { status: true };
  } catch (error) {
    // Return error status with details
    return {
      status: false,
      message: `❌❌ An error occurred while adding a tutor to service ${serviceId} ❌❌`,
      error: error.message || error,
    };
  }
};

const archiveJob = async (serviceId) => {
  let response = await fetch(`https://lgshxjbxultdbfbgallu.supabase.co/rest/v1/matching_db?id=eq.${serviceId}`, {
    method: "PATCH",
    headers: {
      apikey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnc2h4amJ4dWx0ZGJmYmdhbGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NTQzODIsImV4cCI6MjA1MjQzMDM4Mn0.iHhBr4aIg3qSWthwEkZesc4D3TN7lAtGUhf9tXHDmeM",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      archived: "matched",
    }),
  });
};

const mainRecursiveMethod = async (pptrPage) => {
  let tutorsToAddList = await getDataFromSupabase();
  let listLength = tutorsToAddList.length;

  if (listLength > 0) {
    for (let i = 0; i < listLength; i++) {
      let row = tutorsToAddList[i];
      let res = await fetchTutorById(row.tutor_id);
      let { last_name, first_name } = res?.user;
      console.log(`⚙  Adding tutor(${row.tutor_id}, ${last_name} ${first_name}) to service(${row.service_id})`);
      let pptrResponse = await goToPageAndAddTutorToService(pptrPage, row?.service_id, last_name, first_name);
      console.log(pptrResponse);
      if (pptrResponse.status) {
        archiveJob(row?.service_id);
      }
    }
  } else {
    console.log("❌ No rows found");
  }

  console.log("⏱  waiting for 10 seconds before next recursive iteration");
  await waitNSeconds(10);
  mainRecursiveMethod(pptrPage);
};

const main = async () => {
  const wsChromeEndpointUrl = await getWsContext();
  if (!wsChromeEndpointUrl) {
    return;
  }
  const browser = await puppeteer.launch({
    browserWSEndpoint: wsChromeEndpointUrl,
    // slowMo: 150,
    // headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1024 });

  mainRecursiveMethod(page);

  // await waitNSeconds(10);
  // page.close();

  // process.exit(0);
};

main();
