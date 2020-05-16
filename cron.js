const got = require("got");

const timezones = require("./timezones");
const error = (message) => {
	return {message};
}
function addUpdate(task, expression, update, API_URL) {
	return new Promise((resolve, reject) => {
		let {
			id = null,
			minute = '*',
				hour = '*',
				day = '*',
				month = '*',
				/* minute, hour, day, month: These are used to specify a specific time when the
				cron job will run.
the cron job will run at every 5th minute from 9:08 to 9:59 on 5th December every year.
You must specify at least one of these options. If any option is omitted, that option is read as "every ".
For eg., if minute is not specified, then it is assumed to be "every minute" and the job will run at every
 minute from 9:08 to 9:59 on 5th December every year.
*/
				minuteInterval = null,
				cron: cron_expression = null,
				url = null,
				method: http_method = null,
				headers: http_headers = null,
				payload: posts = null,
				name = null,
				groupId = 0,
				timezone = null
		} = task;
/* minuteInterval: It is used to specify that the cron job will repeat itself in intervals of specified minutes.

url: It refers to the URL which will be called by the cron job.

method: It specifies the http method to be used for the request.

timezone: It specifies the timezone to be used for the request. Must be a valid name from tz database

headers: It specifies the headers to be used for the request.

payload: It specifies the json object to be sent in the body of request. When this cron job will run, easy cron will send a POST request to the specified URL with payload in body of the request. You can get the payload as follows:

let payload = JSON.parse(request.body.payload);*/
		let queryString;
		if (expression) {
			if (!(typeof cron_expression === "string" && cron_expression.length > 0)) {
				reject(new Error("cron expression not received in input"));
			}
			queryString = "&cron_expression=" + encodeURIComponent(cron_expression);
		} else {
			if (minute === "*" && hour === "*" && day === "*" && month === "*") {
				reject(new Error("Provide at least minute, hour, day or month in input"));
			}
			const params = {
				minute,
				hour,
				day,
				month
			};

			Object.keys(params).forEach(key => {
				const value = params[key];
				const int = parseInt(value);
				if ( Number.isNaN(int) && value !== "*") {
					reject(new Error(key + " is invalid"));
				}
				params[key] = value === "*" ? "*" : int;
			});

			if (minuteInterval !== null) {
				const int = parseInt(minuteInterval);
				if (!Number.isNaN(int) && minuteInterval > 0) {
					params.minute += "/" + int;
				} else {
					reject(new Error("Invalid minuteInterval received in input"));
				}
			}
			queryString = "&cron_expression=" + encodeURIComponent(params.minute + ' ' + params.hour + ' ' + params.day + ' ' + params.month + " *");
		}
		if(url === null){
			reject(new Error("url not received in input"));
		} else if (!(typeof url === "string" && url.length > 0)) {
			reject(new Error("Invalid url received in input"));
		}
		queryString += "&url=" + encodeURIComponent(url);

		if(http_method !== null){
			if (!(typeof http_method === "string" && http_method.length > 0)) {
				reject(new Error("Invalid http method received in input"));
			}
			queryString += "&http_method=" + encodeURIComponent(http_method);
		}

		if (http_headers !== null) {
			if( !(http_headers === Object(http_headers) && !Array.isArray(http_headers)) ){
				reject(new Error("Expected headers to be an object"));
			}
			let headers = "";
			Object.keys(http_headers).forEach(key => headers += key + ":" + http_headers[key] + '\n');
			queryString += "&http_headers=" + encodeURIComponent(headers);
		}

		if (posts !== null) {
				if (typeof posts === "object") {
					queryString += "&posts=" + encodeURIComponent("payload=" + JSON.stringify(posts));
				} else {
					reject(new Error("Expected payload to be an object"));
				}
		}

		if(name !== null){
			if(typeof name !== "string"){
				reject(new Error("Expected name to be a string"));
			}
			queryString += "&cron_job_name=" + encodeURIComponent(name);
		}

		if(groupId !== 0){
			if(typeof groupId !== "number"){
				reject(new Error("Expected groupId to be a number"));
			}
			groupId = Number(groupId);
			queryString += "&group_id=" + encodeURIComponent(groupId);
		}

		if(timezone !== null){
			if(typeof timezone !== "string"){
				reject(new Error("Expected timezone to be a string"));
			}
			const substitution = timezones.substitutions[timezone];
			timezone = (!timezones.supported[timezone] && substitution) ? substitution : timezone;
			queryString += "&timezone_from=2&timezone=" + encodeURIComponent(timezone);
		}

		if(update){
			if(!["string", "number"].includes(typeof id)){
				reject(new Error("Expected id to be a string or a number"));
			}
			queryString += "&id=" + encodeURIComponent(id);
		}
// to check the timezones
		got.get(API_URL + queryString)
			.then(res => {
				const response = JSON.parse(res.body);
				if(response.error){
					return reject(new Error(response.error.message));
				}
				resolve(response);
			})
			.catch(error => {
				if (error.name) {
					error.message = error.name;
				}
				reject(error);
			});
	});
}
/* It is used to reject if wrong. */
function changeState (task = {}, API_URL) {
	return new Promise((resolve, reject) => {
		let { id = null } = task;
		if(id === null){
			reject(new Error("Cron id not received in input"));
		} else if (!((typeof id === "string" && id.length > 0) || typeof id === "number")) {
			reject(new Error("Invalid cron id received in input"));
		}
		got.get(API_URL + "&id=" + id)
			.then(res => {
				const response = JSON.parse(res.body);
				if (response.error) {
					return reject(new Error(response.error.message));
				}
				resolve(response);
			})
			.catch(error => {
				if (error.name) {
					error.message = error.name;
				}
				reject(error);
			});
	});
}
// match API and ID.
function list(API_URL){
	return got.get(API_URL + "&size=10000")
		.then(res => {
			const response = JSON.parse(res.body);
			if (response.error) {
				return Promise.reject(new Error(response.error.message));
			}
			return response;
		})
		.catch(error => {
			console.error(error);
			if (error.name) {
				error.message = error.name;
			}
			return Promise.reject(error);
		});
}

function easyCron(config = {}) {
	if (!(config && typeof config.token === "string" && config.token.length !== 0)) {
		throw new Error("Token not found");
	}
	const API_URL = "https://www.easycron.com/rest/";
	const token = config.token;

	return {
		add: (task) => addUpdate(task, false, false, API_URL + "add?token=" + token),
		addCronExp: (task) => addUpdate(task, true, false, API_URL + "add?token=" + token),
		edit: (task) => addUpdate(task, Boolean(task.cron), true, API_URL + "edit?token=" + token),
		enable: (task) => changeState (task, API_URL + "enable?token=" + token),
		disable: (task) => changeState (task, API_URL + "disable?token=" + token),
		delete: (task) => changeState (task, API_URL + "delete?token=" + token),
		list: () => list(API_URL + "list?token=" + token),
		isValidTimezone: ({name}) => Boolean(timezones.supported[name] || timezones.substitutions[name])
	}

};
/* It is used to disable a cron job.

Explanation:

id: It specifies the id of the cron job. */
module.exports = easyCron;
