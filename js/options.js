function save_options() {
	localStorage['uTracking'] = document.getElementById('uTracking').value;
	localStorage['showOn'] = document.getElementById('showOn').checked;

	var status = document.getElementById('status');
	status.textContent = 'Option saved.';
	setTimeout(function() { status.textContent = ''; }, 1000);
}

function restore_options() {
	document.getElementById('uTracking').value = localStorage['uTracking'] || 0;
	document.getElementById('showOn').checked = (localStorage['showOn']=="true") || false;
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);