////////////// HELPERS
function GuiWriteResult(resultText)
{
  document.getElementById("result").textContent = resultText;
}

function cmdKamadoState()
{
  const refreshState = () =>
  {
    iKamandGetStatus().then(r =>
    {
      document.getElementById("stateFanSpeed").textContent = r["fan_speed"];
      document.getElementById("stateProbePit").textContent = r["pit_temp"] + "/" + r["target_temp"];
      document.getElementById("stateProbe1").textContent = r["probe_1_temp"];
      document.getElementById("stateProbe2").textContent = r["probe_2_temp"];
      document.getElementById("stateProbe3").textContent = r["probe_3_temp"];
      document.getElementById("stateOther").textContent = r["rm"] + "," + r["cm"] + "," + r["ag"] + "," + r["as"];
      GuiWriteResult("RES:" + JSON.stringify(r))
    });
  };
  refreshState();
  setInterval(() => refreshState(), 1000 * 10);
}

function cmdKamadoInfo()
{
  iKamandGeInfo().then(r =>
  {
    GuiWriteResult(r)
  });
}

function cmdKamadoStart()
{
  GuiWriteResult("Cooking...");
  const options = {
    target_pit_temperature: document.getElementById("target_pit_temperature").value,
    target_food_temperature: document.getElementById("target_food_temperature").value
  };
  iKamandStartCook(options);
  GuiWriteResult("Cooking is running");
}

function cmdKamadoStop()
{
  GuiWriteResult("Stopping...");
  iKamandStopCook();
  GuiWriteResult("Stopped");
}

function cmdKamadoQueryWifis()
{
  GuiWriteResult("Querying wifi...");
  iKamandQueryWifis().then(r =>
  {
    GuiWriteResult(r);
  });
}

function cmdKamadoSetWifi()
{
  const wifi_ssid = document.getElementById("wifi_ssid").value;
  const wifi_pass = document.getElementById("wifi_pass").value;
  const wifi_user = document.getElementById("wifi_user").value;
  GuiWriteResult("Configuring wifi...");
  iKamandSetupWifi(wifi_ssid, wifi_pass, wifi_user).then(r =>
  {
    GuiWriteResult(r);
  });
}

function CmdSetTargetPit(value)
{
  return document.getElementById("target_pit_temperature").value = value;
}

function CmdSetTargetFood(value)
{
  return document.getElementById("target_food_temperature").value = value;
}

function CmdSetIp(value)
{
  return document.getElementById("ip").value = value;
}

/////////////// IKAMAND
function getFullUrl(path)
{
  const ip = document.getElementById("ip").value;

  return `http://${ip}` + path;
  //return "https://ikamand.free.beeceptor.com" + path;
}

function fetchData(url, options)
{
  options = {
    ...options,
    //mode: "no-cors"
  };
  return fetch(url, options)
    .then(response =>
    {
      if (!response.ok)
      {
        GuiWriteResult('Request failed', JSON.stringify(response));
        throw new Error("Request failed");
      }
      return response.text();
    })
    .then((response) => 
    {
      console.log(response);
      return response;
    })
    .catch((error) =>
    {
      GuiWriteResult('Request failed:', error.message, JSON.stringify(error));
      return null;
    });
}

function fetchAndDecodeData(url, options)
{
  return fetchData(url, options)
    .then(response =>
    {
      const obj = iKamandTranslateState(response);
      console.log("translated:" + JSON.stringify(obj));
      return obj;
    });
}

function iKamandConvertToObj(text)
{
  const dictionary = {};
  text.split('&').forEach((line) =>
  {
    if (line)
    {
      const [key, value] = line.split('=');
      dictionary[key] = value;
    }
  });
  return dictionary;
}

function iKamandTranslateState(rawText)
{
  const input = iKamandConvertToObj(rawText);
  const dictionary = {
    time: input['time'],
    rm: input['rm'],
    active: input['acs'],
    session_id: input['csid'],
    cm: input['cm'],
    ag: input['ag'],
    as: input['as'],
    pit_temp: input['pt'],
    probe_1_temp: input['t1'],
    probe_2_temp: input['t2'],
    probe_3_temp: input['t3'],
    fan_speed: input['dc'],
    target_temp: input['tpt'],
  };
  return dictionary;
}

function iKamandGeInfo()
{
  GuiWriteResult("Fetching status...");
  console.log(getFullUrl("/cgi-bin/info"));
  return fetchData(
    getFullUrl("/cgi-bin/info")
  );
}

function iKamandGetStatus()
{
  GuiWriteResult("Fetching status...");
  console.log(getFullUrl("/cgi-bin/data"));
  return fetchAndDecodeData(
    getFullUrl("/cgi-bin/data")
  );
}

function iKamandStartCook(options)
{
  const currentTime = Math.floor(Date.now() / 1000);
  const currentTimePlusOneDay = currentTime + 86400;

  const payload = new URLSearchParams();
  payload.set('acs', '1');
  payload.set('csid', uuidv4());
  payload.set('tpt', options.target_pit_temperature ?? '50');
  payload.set('sce', currentTimePlusOneDay.toString());
  payload.set('p', '1');
  payload.set('tft', options.target_food_temperature ?? '50');
  payload.set('as', '0');
  payload.set('ct', currentTime.toString());

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  return fetchAndDecodeData(getFullUrl("/cgi-bin/cook"), {
    method: 'POST',
    body: payload,
    headers: headers,
  });
}

function iKamandStopCook()
{
  const payload = new URLSearchParams();
  payload.set('acs', '0');
  payload.set('csid', '');
  payload.set('tpt', '120');
  payload.set('sce', '0');
  payload.set('p', '0');
  payload.set('tft', '0');
  payload.set('as', '0');
  payload.set('ct', Math.floor(Date.now() / 1000).toString());

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  return fetchAndDecodeData(getFullUrl("/cgi-bin/cook"), {
    method: 'POST',
    body: payload,
    headers: headers,
  })
}

function iKamandQueryWifis()
{
  return fetchData(getFullUrl("/cgi-bin/wifi_list"), {
    method: 'GET',
  });
}

function iKamandSetupWifi(ssid, pass, user)
{
  const payload = new URLSearchParams();
  payload.set('ssid', btoa(ssid));
  payload.set('pass', btoa(pass));
  payload.set('user', "" /*btoa(uuidv4())*/);
  
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  return fetchData(getFullUrl("/cgi-bin/netset"), {
    method: 'POST',
    body: payload,
    headers: headers,
  });
}

/////////////// helpers
function uuidv4()
{
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c)
  {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}