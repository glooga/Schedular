function processAudit(e) {
	var lines = e.split("\n"),
			currentsection, matches,
			requirements = [],
			unclassified = [];
	for (var i = 0; i < lines.length; i++) {
		matches = lines[i].match(/^([^\t]+?)\tShow\/Hide/i);
		if (matches) {
			var heading = matches[1].trim().substring(0, 15);
			if (heading == "Core Curriculum") currentsection = "core";
			else if (heading == "Curriculum Flag") currentsection = "flags";
			else currentsection = "unknown";
		} else {
			matches = lines[i].match(/(\d)\t(.+?)\t(.+?)\t(.+?)\t(.+?)\t(.+?)\t(.+?)\t/i);
			if (matches && matches[2] != "completed") {
				if (currentsection == "core" || currentsection == "flags") {
					requirements.push({
						type: currentsection,
						value: matches[3].match(/\((.*?)\)/i)[1],
						input: matches[3]
					});
				} else {
					unclassified.push(matches[3]);
				}
			}
		}
	}
	return {
		requirements: requirements,
		unclassified: unclassified
	};
}

if ($("#preferences").length > 0) {
	$("#preferences .primary").click(function() {
		finishSection("preferences");
	});
	
	function finishSection(name) {
		$("#"+name).addClass("disabled").append($("<div>").addClass("overlay").html("<b>completed</b>"));
		$("#"+name).next("section").removeClass("collapsed");
	}
	
	$(".weekview").each(function() {
		var actual = $(this).find("tbody");
		for (var i = 6; i <= 20; i++) {
			var row = $("<tr>");
			row.append($("<td>").addClass("right").text((i < 13 ? i : i % 12)+":00"));
			for (var j = 0; j <= 4; j++) {
				row.append($("<td><input type=checkbox checked id=d"+j+"t"+i+" /><label for=d"+j+"t"+i+" />"));
			}
			actual.append(row);
		}
	});
	
	$("#import button").click(function() {
		var parsed = processAudit($("#import textarea").val());
		for (var i = 0; i < parsed.unclassified.length; i++) {
			var u = parsed.unclassified[i];
			$("#unclassified ul").append($("<li>").text(u));
		}
		for (var i = 0; i < parsed.requirements.length; i++) {
			var r = parsed.requirements[i];
			addRequirement("regular", r.type, [r.value]);
		}
		finishSection("import");
		if (parsed.unclassified.length == 0) {
			$("#unclassified").hide();
			$("#classes, #chosen").removeClass("collapsed");
		}
	});
	
	$("#unclassified .primary").click(function() {
		$("#unclassified .buttons").hide();
		$("#classes, #chosen").removeClass("collapsed");
	});
	
	$("#classes .primary").click(function() {
		var selection = $("#picker .options > div:visible").find("input, select"), s = [];
		selection.each(function() {
			if ($(this).val()) s.push($(this).val());
		});
		if (s.length > 0) addRequirement($("#picker .priority").val(), $("#picker .filter").val(), s);
	});
	
	$("#classes").find("input, select, button").on("keydown keypress", function(e) {
		if (e.which == 13) {
			$("#classes .primary").click();
			e.preventDefault();
		}
	});
	
	function addRequirement(priority, type, values) {
		var item = $("<div class=item>"), options = $("<div>"),
				t = $("#picker .filter option[value='"+type+"']").text(),
				v = "";
		for (var i = 0; i < values.length; i++) {
			var displayable = values[i],
					dropdown = $("#picker .options ."+type.replace(/\s/g, "")+" select");
			if (dropdown.length > 0) displayable = dropdown.find("option[value='"+displayable+"']").text();
			v += displayable+" or ";
		}
		v = v.substring(0, v.length-4);
		item.append(document.createTextNode((priority == "high" ? "I have to have a class " : "It would be nice to have a class ")+t+" "+v+". "));
		options.append($("<a href=#edit>").html("edit").click(function() {
			var picker = $("#picker"), item = $(this).parents(".item");
			picker.find(".priority").val(item.attr("data-priority")).focus();
			picker.find(".filter").val(item.attr("data-type")).change();
			picker.find(".options > div:visible > *").val(JSON.parse(item.attr("data-value"))[0]);
			item.remove();
			return false;
		}));
		options.append(document.createTextNode(" "));
		options.append($("<a href=#delete>").html("remove").click(function() {
			$(this).parents(".item").remove();
			return false;
		}));
		item.append(options);
		item.attr("data-priority", priority);
		item.attr("data-type", type);
		item.attr("data-value", JSON.stringify(values));
		$("#chosen .contents").append(item);
		$("#chosen .empty").hide();
		$("#picker .options").find("input, select").each(function() {
			$(this).val("");
		});
		$("#picker .orable").each(function() {
			$(this).find(".value").slice(1).remove();
			$(this).find("input, select").val("");
		});
	}
	
	$("#picker .filter").change(function() {
		$("#picker .options > div").hide();
		$("#picker .options ."+$(this).val().replace(/\s/g, "")).show();
	}).change();
	
	$("#picker .orable").find("select, input").on("keyup keydown keypress mouseup click", addInputIfNeeded);
	
	function addInputIfNeeded() {
		var orable = $(this).parents(".orable");
		if (orable.children(".value").length > 1) {
			orable.children(".value").each(function() {
				var input = $(this).find("input, select");
				if (!input.val() && !input.is(":focus")) {
					$(this).remove();
				}
			});
		}
		if ($(this).val() && (
			$(this).parents(".value").next(".value").length == 0 ||
			orable.children(".value").last().find("input, select").val())) {
			// add an input
			orable.append($(this).parents(".value").clone());
			orable.children(".value").last().find("input, select").val("").on("keyup keydown keypress mouseup click", addInputIfNeeded);
		}
	}
	
	$("main > form").submit(function(e) {
		var unavailable = [],
				filters = [],
				days = ["M", "T", "W", "TH", "F"];
		for (var i = 0; i < days.length; i++) {
			for (var j = 6; j <= 20; j++) {
				if (!$("#d"+i+"t"+j).is(":checked")) {
					var t = {
						day: days[i],
						start: j*60,
						end: (j+1)*60
					}
					while (j <= 20 && !$("#d"+i+"t"+(j+1)).is(":checked")) {
						j++;
						t.end += 60;
					}
					unavailable.push(t);
				}
			}
		}
		$("input[name=unavailable]").val(JSON.stringify(unavailable));
		$("#chosen .contents .item").each(function() {
			var item = $(this);
			filters.push({
				priority: item.attr("data-priority"),
				type: item.attr("data-type"),
				value: JSON.parse(item.attr("data-value")),
			});
		});
		$("input[name=filters]").val(JSON.stringify(filters));
		$("#loader").show().outerWidth();
		$("#loader").addClass("shown");
		e.preventDefault();
	});
	
	$("#import a").click(function() {
		setTimeout(function() {
			if (!$("#import").hasClass("disabled")) {
				alert("Don't forget to paste your degree audit into the textbox.");
			}
		}, 60*1000);
	});
}
if ($("#results").length > 0) {
	$("#results .result").click(function() {
		if ($(this).next(":not(.template)").hasClass("expanded")) {
			$(this).next(".expanded").remove();
			return false;
		}
		var expando = $(".expanded.template").clone().removeClass("template");
		var actual = expando.find(".weekview").find("tbody");
		for (var i = 6; i <= 20; i++) {
			var suffix = [":00", ":30"];
			for (var j = 0; j < suffix.length; j++) {
				var row = $("<tr>");
				row.append($("<td>").addClass("right").text((i < 13 ? i : i % 12)+suffix[j]));
				row.append($("<td colspan=5>"));
				actual.append(row);
			}
		}
		/*expando.find("coursesummary").text();
		var list = expando.find("courses");
		for (var j = 0; j < suffix.length; j++) {
			var item = $("<li>");
			row.append(document.createTextNode());
			row.append($("<a>").attr("href", "#").text());
			row.append(document.createTextNode());
			list.append(item);
		}
		expando.find("requirementsummary").text();
		var list = expando.find("requirements");
		for (var j = 0; j < suffix.length; j++) {
			var item = $("<li>");
			row.append(document.createTextNode());
			row.append($("<a>").attr("href", "#").text());
			row.append(document.createTextNode());
			list.append(item);
		}*/
		expando.find(".schedulelink").focus(function() {
			$(this).select();
			setTimeout(function() {
				$(this)[0].setSelectionRange(0, 999);
			}, 0);
		});
		$(this).after(expando);
		return false;
	});
}