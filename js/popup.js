function render(data) {
	var profile = data.profile;
	if (profile != null) {
		var friendCount = data.friendCount;
		var changesHtml = data.changesHtml;
		$('#name').html('Вы вошли как: <a href="https://www.facebook.com/' + profile.name + '">' + profile.name + '</a>' +
			'</br>Сейчас у вас ' + friendCount + ' друзей.');
		$('#changeLog').html(changesHtml);
		if (changesHtml.length == 0) {
			$('#lastChanges').html("Никто не отписывался");
		} else {
			$('#lastChanges').html("Последние изменения:");
		}
		$('#changeLog').show();
		$('#lastChanges').show();
	} else {
		$('#name').html('Вы не вошли: <a href="https://www.facebook.com/">Войти в Facebook</a>');
		$('#changeLog').hide();
		$('#lastChanges').hide();
	}
}

function main() {
	var background = chrome.extension.getBackgroundPage();
	var data = background.getPopupData();
	render(data);

	$('body').on('click', 'a', function () {
		chrome.tabs.create({
			url: $(this).attr('href')
		});
		return false;
	});
}

document.addEventListener('DOMContentLoaded', main);