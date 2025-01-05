//SUCCESSFULLY have access to Jquery
//Works
$.getJSON('data/talks.json', function (data) {
    console.log(data);
    data.talksInYears.forEach(element => {
        document.getElementById("talks-container").innerHTML += `
            <div class="year">    
                ${element.year} <span class="year-amount">(${element.talks.length})</span>
            </div>
        `;
        element.talks.forEach(talk => {
            if (talk.display === true) {
                let locationBlock = "";
                if (talk.where != null) {
                    locationBlock = `<div class="talk-location">${highlightOnline(talk.where)}</div>`;
                }
                let linkBlock = "";
                if (talk.link != null) {
                    linkBlock = `<div class="talk-link"><a href="${talk.link}">${talk.link}</a></div>`;
                }
                let selfieImageBlock = "";
                if (talk.selfieImage != undefined && talk.selfieImage != null) {
                    selfieImageBlock = `<img class="selfie-image" onmouseover="showLargeImage('${talk.selfieImage}')" onmouseout="hideLargeImage()" src="media/photos/selfies/${talk.selfieImage}"/>`;
                }
                document.getElementById("talks-container").appendChild(createElementsFromHTML(`
                    <div class="links-container-wide">
                        <div class="talk-date">
                            ${getShortDate(talk.date)}
                        </div>
                        <div class="talk-talk-block">
                            <div class="talk-flex-container">
                                <div>
                                    <div class="talk-title">${talk.title}</div>
                                    ${locationBlock}
                                    ${linkBlock}
                                </div>
                                ${selfieImageBlock}
                            </div>
                        </div>
                    </div>
                `));
            }
        });
    });
});
//<div class="talk-title">${titleCase(talk.title)}</div>
//

function showLargeImage(imageName) {
    console.log(imageName);
    var dialogBox = document.createElement('div')
    dialogBox.id = 'generic-dialog'
    dialogBox.innerHTML = `<img class="larger-image" src="media/photos/selfies/${imageName}" />`
    // dialogBox.style.top = `${posY}px`
    // dialogBox.style.left = `${posX}px`
    document.body.appendChild(dialogBox)
}

function hideLargeImage() {

    let elem = document.getElementById('generic-dialog')
    if (elem != undefined && elem != null) {
        document.body.removeChild(elem)
        // dialogShowTS = null;
        // currentDialogType = null;
    }
}

function highlightOnline(str) {
    return str.replace("online", "<b class='online'>online</b>");
}

function getShortDate(dateIn) {
    let splitDate = dateIn.split(".")
    return `${splitDate[0]} - ${splitDate[1]}`;
}

function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        // You do not need to check if i is larger than splitStr length, as your for does that for you
        // Assign it back to the array
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(' ');
}

function createElementsFromHTML(html) {
    let elm = document.createElement("div");
    elm.innerHTML = html;
    return elm
}



// import date from '../utils/date.js';
// import dialogContents from './dialogContents.js'

// const FLOATING_DIALOG_POSITION = {
//     LEFT: 'LEFT',
//     RIGHT: 'RIGHT',
//     BOTTOM_LEFT: 'BOTTOM_LEFT',
//     BOTTOM_RIGHT: 'BOTTOM_RIGHT'
// }

// const DIALOG_TYPES = {
//     AUTO_DISMISSABLE: 'AUTO_DISMISSABLE',
//     NORMAL: 'NORMAL'
// }

// const SPACE_BUFFER = 10
// let dialogShowTS = null;
// let currentDialogType = null

// const DIALOG_SAFETY_TIME_BUFFER = 100

// function clickOffDialogHide() {
//     if (dialogShowTS != null) {
//         let nowTs = date.getTimestamp()
//         let diff = nowTs - dialogShowTS;

//         if (diff > DIALOG_SAFETY_TIME_BUFFER && currentDialogType == DIALOG_TYPES.AUTO_DISMISSABLE) {
//             hideGenericHoverDialog()
//         }
//     }
// }

// function isDialogPresent() {
//     console.log(dialogShowTS);

//     return dialogShowTS != null;
// }

// export default {
//     displayGenericHoverDialogWithId: displayGenericHoverDialogWithId,
//     hideGenericHoverDialog: hideGenericHoverDialog,
//     DIALOG_CONTENTS: dialogContents.DIALOG_CONTENTS,
//     FLOATING_DIALOG_POSITION: FLOATING_DIALOG_POSITION,
//     displayAllStepsOfRelease: displayAllStepsOfRelease,
//     hideAllStepsOfRelease: hideAllStepsOfRelease,
//     displayGenericHoverDialogWithContent: displayGenericHoverDialogWithContent,
//     isDialogPresent: isDialogPresent,
//     clickOffDialogHide: clickOffDialogHide,
//     DIALOG_TYPES: DIALOG_TYPES

// }

// function getSizeOfElement(elem) {
//     document.body.appendChild(elem)
//     let rect = elem.getBoundingClientRect()
//     document.body.removeChild(elem)
//     return rect
// }

// function baseDisplayDialog(contents, anchor, containerAdditionalClasses, position, type) {
//     hideGenericHoverDialog()
//     var e = window.event
//     var posX = 100
//     var posY = 100
//     if (e != undefined) {
//         posX = e.clientX + SPACE_BUFFER
//         posY = e.clientY + SPACE_BUFFER
//     }

//     let htmlText = `
//         <div class="generic-dialog-container ${containerAdditionalClasses}">
//             ${contents}
//         </div>
//     `
//     var dialogBox = document.createElement('div')
//     dialogBox.id = 'generic-dialog'
//     dialogBox.innerHTML = htmlText
//     dialogBox.style.top = `${posY}px`
//     dialogBox.style.left = `${posX}px`

//     let size = getSizeOfElement(dialogBox)

//     if (posX + size.width >= window.innerWidth) {
//         dialogBox.style.maxWidth = "50%"
//         dialogBox.style.whiteSpace = "normal"

//         let remeasure = getSizeOfElement(dialogBox)
//         if (posX + remeasure.width >= window.innerWidth) {
//             dialogBox.style.right = `${window.innerWidth - posX + SPACE_BUFFER}px`
//             dialogBox.style.left = "unset"
//         }
//     }
//     if (posY + size.height >= window.innerHeight) {
//         dialogBox.style.bottom = `${window.innerHeight - posY + SPACE_BUFFER}px`
//         dialogBox.style.top = "unset"
//     }
//     document.body.appendChild(dialogBox)
//     dialogShowTS = date.getTimestamp()
//     currentDialogType = type
// }

// function displayGenericHoverDialogWithContent(contentHTML, type) {
//     baseDisplayDialog(contentHTML, undefined, undefined, undefined, type)
// }

// function displayGenericHoverDialogWithId(contentHTMLId) {
//     let displayContents = ''
//     let displayDialogContentObject = null
//     Object.values(dialogContents.DIALOG_CONTENTS).forEach(element => {
//         if (element.id == contentHTMLId) {
//             displayDialogContentObject = element
//         }
//     })

//     if (displayDialogContentObject.isMarkdown) {
//         let converter = new window.showdown.Converter()
//         let out = converter.makeHtml(displayDialogContentObject.contents)
//         displayContents = out
//     } else {
//         displayContents = displayDialogContentObject.contents
//         console.log('NOT')
//     }
//     baseDisplayDialog(displayContents, "", displayDialogContentObject.isMarkdown ? 'markdown-container' : '')
// }

// function hideGenericHoverDialog() {
//     let otherelem = document.getElementById('all-next-steps-dialog')
//     if (otherelem != undefined && otherelem != null) {
//         document.body.removeChild(otherelem)
//         dialogShowTS = null;
//         currentDialogType = null;
//     }
//     let elem = document.getElementById('generic-dialog')
//     if (elem != undefined && elem != null) {
//         document.body.removeChild(elem)
//         dialogShowTS = null;
//         currentDialogType = null;
//     }
// }


// function displayAllStepsOfRelease(nextSteps, currentId) {
//     let cont = ''
//     Object.values(nextSteps).filter(e => {
//         return e.isReleaseStage == true
//     }).forEach((key, index) => {
//         let currentOne = ''
//         if (currentId == key.id) {
//             currentOne = 'current-next-step'
//         }
//         cont += `
//             <div class="${currentOne} single-next-step-in-dialog">${index + 1}. ${key.title}</div>
//         `
//     })
//     baseDisplayDialog(cont, "", "")
// }

// function hideAllStepsOfRelease() {
//     let elem = document.getElementById('all-next-steps-dialog')
//     document.body.removeChild(elem)
// }
