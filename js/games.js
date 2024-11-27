//SUCCESSFULLY have access to Jquery
//Works
$.getJSON('games.json', function (data) {
    console.log(data);
    let out = "";
    data.games.forEach(element => {
        console.log(element);
        out += `
            <div class="game-box">
                <div class="game-title">${element.name}</div>
                <div><img src="${element.thumbnail}"/></div>
            </div>
        `
         
    });

    document.getElementById("games-container").innerHTML = out;
    // data.talksInYears.forEach(element => {
    //     document.getElementById("talks-container").innerHTML += `
    //         <div class="year">    
    //             ${element.year}
    //         </div>
    //     `;
    //     element.talks.forEach(talk => {
    //         if (talk.display === true) {
    //             let locationBlock = "";
    //             if (talk.where != null) {
    //                 locationBlock = `<div class="talk-location">${highlightOnline(talk.where)}</div>`;
    //             }
    //             let linkBlock = "";
    //             if (talk.link != null) {
    //                 linkBlock = `<div class="talk-link"><a href="${talk.link}">${talk.link}</a></div>`;
    //             }
    //             let selfieImageBlock = "";
    //             if (talk.selfieImage != undefined && talk.selfieImage != null) {
    //                 selfieImageBlock = `<img class="selfie-image" onmouseover="showLargeImage('${talk.selfieImage}')" onmouseout="hideLargeImage()" src="media/photos/${talk.selfieImage}"/>`;
    //             }
    //             document.getElementById("talks-container").appendChild(createElementsFromHTML(`
    //                 <div class="links-container-wide">
    //                     <div class="talk-date">
    //                         ${getShortDate(talk.date)}
    //                     </div>
    //                     <div class="talk-talk-block">
    //                         <div class="talk-flex-container">
    //                             <div>
    //                                 <div class="talk-title">${talk.title}</div>
    //                                 ${locationBlock}
    //                                 ${linkBlock}
    //                             </div>
    //                             ${selfieImageBlock}
    //                         </div>
    //                     </div>
    //                 </div>
    //             `));
    //         }
    //     });
    // });
});
//<div class="talk-title">${titleCase(talk.title)}</div>
//

// function showLargeImage(imageName) {
//     console.log(imageName);
//     var dialogBox = document.createElement('div')
//     dialogBox.id = 'generic-dialog'
//     dialogBox.innerHTML = `<img class="larger-image" src="media/photos/${imageName}" />`
//     // dialogBox.style.top = `${posY}px`
//     // dialogBox.style.left = `${posX}px`
//     document.body.appendChild(dialogBox)
// }

// function hideLargeImage() {

//     let elem = document.getElementById('generic-dialog')
//     if (elem != undefined && elem != null) {
//         document.body.removeChild(elem)
//         // dialogShowTS = null;
//         // currentDialogType = null;
//     }
// }

// function highlightOnline(str) {
//     return str.replace("online", "<b class='online'>online</b>");
// }

// function getShortDate(dateIn) {
//     let splitDate = dateIn.split(".")
//     return `${splitDate[0]} - ${splitDate[1]}`;
// }

// function titleCase(str) {
//     var splitStr = str.toLowerCase().split(' ');
//     for (var i = 0; i < splitStr.length; i++) {
//         // You do not need to check if i is larger than splitStr length, as your for does that for you
//         // Assign it back to the array
//         splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
//     }
//     // Directly return the joined string
//     return splitStr.join(' ');
// }

// function createElementsFromHTML(html) {
//     let elm = document.createElement("div");
//     elm.innerHTML = html;
//     return elm
// }
