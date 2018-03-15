var checkDelay = 10000;
var globalProfile;
var globalFriends;
var globalLog;

function getUrl(url, callback) {
	var result = null;
	$.ajax({
			url: url,
			type: 'GET',
			async: true,
			timeout: 3000
		})
		.done(function (data) {
			result = data;
		})
		.fail(function () {
			console.log("Error requesting: " + url);
		})
		.always(function () {
			callback(result);
		});
}

function getFriendsList(userId, startAt, callback) {
	var friendsListLink = "https://www.facebook.com/ajax/browser/list/allfriends/?uid=" + userId + "&__a=1&start=" + startAt;
	getUrl(friendsListLink, function (response) {
		if (response == null) {
			callback(null);
			return;
		}
		var json = response.substr(9); // Cut to actual JSON
		json = JSON.parse(json);
		var friendsHtml = json.domops[0][3].__html; // Get friends HTML from JSON
		var listHtml = $(friendsHtml).find("ul")[0];
		var friendsHtmlArray = $(listHtml).find("li");
		var friends = [];
		for (var i = friendsHtmlArray.length - 1; i >= 0; i--) {
			var friendHtml = friendsHtmlArray[i].innerHTML;
			var friendName = $(friendHtml).find(".fcb")[0].innerText;
			var friendDataHovercard = $(friendHtml).find(".fcb > a")[0].attributes.getNamedItem("data-hovercard");
			var friendId = friendDataHovercard.value.split("=")[1].split("&")[0];
			var friend = {};
			friend.name = friendName;
			friend.id = friendId;
			friends.unshift(friend);
		}
		var moreHtml = $(friendsHtml).find(".uiMorePagerPrimary");
		var isMore = moreHtml.length > 0;
		if (isMore) {
			getFriendsList(userId, startAt + 24, function (moreFriends) {
				if (moreFriends == null) {
					callback(null);
					return;
				}
				callback(friends.concat(moreFriends));
			});
		} else {
			callback(friends);
		}
	});
}

function notification(text) {
	var notification = {
		type: "basic",
		title: "Unfriendly",
		message: text,
		iconUrl: "../img/icon.png",
		requireInteraction: true
	};
	chrome.notifications.create("1", notification, function () {});
}

function getProfile(callback) {
	getUrl("https://www.facebook.com/", function (page) {
		if (page == null) {
			callback(null);
			return;
		}
		var profileAnchor = $(page).find("._2s25")[0];
		if (profileAnchor == undefined) {
			return null;
		}
		var profileName = profileAnchor.href.split("/")[3];
		var profileImage = $(profileAnchor).find("img")[0];
		var profileId = profileImage.id.split("_")[3];
		var profile = {};
		profile.name = profileName;
		profile.id = profileId;
		callback(profile);
	});
}

function saveFriends(profileId, friends) {
	localStorage.setItem("friends-" + profileId, JSON.stringify(friends));
}

function loadFriends(profileId, callback) {
	var savedFriends = localStorage.getItem("friends-" + profileId);
	if (savedFriends == null) {
		getFriendsList(profileId, 0, function (friends) {
			if (friends == null) {
				callback(null);
				return;
			}
			console.log("Loaded " + friends.length + " friends from Facebook");
			callback(friends);
		});
	} else {
		var friends = JSON.parse(savedFriends);
		console.log("Loaded " + friends.length + " friends from local storage");
		callback(friends);
	}
}

function saveLog(profileId, log) {
	localStorage.setItem("log-" + profileId, JSON.stringify(log));
}

function loadLog(profileId) {
	var log = JSON.parse(localStorage.getItem("log-" + profileId));
	if (log == null) {
		log = [];
	}
	console.log("Loaded " + log.length + " friend changes from local storage");
	return log;
}

function getMissingFriends(oldFriends, newFriends) {
	var missingFriends = [];
	// Iterate over all old friends
	for (var i = 0; i < oldFriends.length; i++) {
		var friend = oldFriends[i];
		// See if the friend is still a friend
		var isFriend = false;
		for (var j = 0; j < newFriends.length; j++) {
			if (newFriends[j].id == friend.id) {
				isFriend = true;
				break;
			}
		}
		if (!isFriend) {
			missingFriends.unshift(friend);
		}
	}
	return missingFriends;
}

function getFriendChanges(oldFriends, newFriends) {
	var removedFriends = getMissingFriends(oldFriends, newFriends);
	var addedFriends = getMissingFriends(newFriends, oldFriends);
	var changes = {};
	changes.added = addedFriends;
	changes.removed = removedFriends;
	return changes;
}

function sendUnfriendNotification(removedFriends) {
	var removedCount = removedFriends.length;
	var text = "";
	for (var i = 0; i < removedCount; i++) {
		text += removedFriends[i].name;
		text += " ";
	}
	if (removedCount > 1) {
		text += "are"
	} else {
		text += "is"
	}
	text += " no longer friends with you!";
	notification(text);
}

function appendToChangeLog(friend, changeType, log) {
	var change = {};
	change.time = Date.now();
	change.type = changeType;
	change.friend = friend;
	log.unshift(change);
}

function appendChangesToLog(changes, log) {
	var friend;
	for (var i = 0; i < changes.removed.length; i++) {
		friend = changes.removed[i];
		appendToChangeLog(friend, "-", log);
	}
	for (var j = 0; j < changes.added.length; j++) {
		friend = changes.added[j];
		appendToChangeLog(friend, "+", log);
	}
}

function getPopupData() {
	var data = {};
	data.profile = globalProfile;
	if (globalProfile != null) {
		data.friendCount = globalFriends.length;
		var changesHtml = "";
		var entries = Math.min(globalLog.length, 10);
		for (var i = 0; i < entries; i++) {
			var change = globalLog[i];
			var changeLine = '<a href="https://www.facebook.com/' + change.friend.id + '"><div class="change ';
			if (change.type === '+') {
				changeLine += 'added"><img src="../img/plus.png"/>';
			} else {
				changeLine += 'removed"><img src="../img/minus.png"/>';
			}
			changeLine += '<span class="friend">' + change.friend.name + "</span>";
			changeLine += '<span class="time">' + new Date(change.time).toLocaleString() + "</span></div></a>";
			changesHtml += changeLine;
		}
		data.changesHtml = changesHtml;
	}
	return data;
}

function profileCheck(callback) {
	getProfile(function (profile) {
		if (profile == null || globalProfile == null) {
			callback(false);
		} else {
			callback(profile.id == globalProfile.id);
		}
	});
}

function loop(profileId) {
	profileCheck(function (match) {
		if (!match) {
			main();
			return;
		}
		getFriendsList(profileId, 0, function (freshFriends) {
			if (freshFriends == null) {
				setTimeout(loop, checkDelay, profileId);
				return;
			}
			var changes = getFriendChanges(globalFriends, freshFriends);
			var removedCount = changes.removed.length;
			var addedCount = changes.added.length;
			var changesDetected = false;

			if (removedCount > 0) {
				changesDetected = true;
				console.log(removedCount + " friend(s) removed");
				sendUnfriendNotification(changes.removed);
			}
			if (addedCount > 0) {
				changesDetected = true;
				console.log(addedCount + " friend(s) added");
			}
			if (!changesDetected) {
				console.log("No changes detected");
			}

			appendChangesToLog(changes, globalLog);

			globalFriends = freshFriends;
			saveFriends(profileId, globalFriends);
			saveLog(profileId, globalLog);

			setTimeout(loop, checkDelay, profileId);
		});
	});
}

function main() {
	getProfile(function (profile) {
		globalProfile = profile;
		if (globalProfile != null) {
			console.log("Profile: " + globalProfile.name + " - " + globalProfile.id);
			loadFriends(globalProfile.id, function (friends) {
				if (friends == null) {
					setTimeout(main, checkDelay);
					return;
				}
				globalFriends = friends;
				globalLog = loadLog(globalProfile.id);
				setTimeout(loop, checkDelay, globalProfile.id);
			});
		} else {
			console.log("Logged out, waiting");
			setTimeout(main, checkDelay);
		}
	});
}

document.addEventListener('DOMContentLoaded', main);