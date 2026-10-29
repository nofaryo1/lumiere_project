import $ from "jquery";

const parseJSON = (text) => { try { return JSON.parse(text); } catch (err) { return {}; } };

// Every request to the LUMIERE server goes through jQuery AJAX
export function api(path, { method = "GET", body, file, headers = {} } = {}) {
  const settings = { url: `/api${path}`, method, headers: { ...headers }, dataType: "text" };
  if (file) {
    Object.assign(settings, { data: file, processData: false, contentType: file.type });
  } else if (body !== undefined) {
    Object.assign(settings, { data: JSON.stringify(body), contentType: "application/json" });
  }
  return new Promise((resolve, reject) => {
    $.ajax(settings)
      .done((text) => resolve(parseJSON(text)))
      .fail((xhr) => {
        if (!xhr.status) {
          reject(Object.assign(new Error("Can't connect to the LUMIERE server. Make sure it's running (npm start) and try again."), { status: 0, data: {} }));
          return;
        }
        const data = parseJSON(xhr.responseText);
        reject(Object.assign(new Error(data.error || "Something went wrong."), { status: xhr.status, data }));
      });
  });
}

// "a=1&b=2" from an object, skipping empty values
export const query = (params) => $.param(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null)));
