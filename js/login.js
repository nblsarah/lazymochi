document.querySelectorAll(".toggle-password").forEach(toggle=>{

    toggle.addEventListener("click",()=>{

        const input = toggle.parentElement.querySelector("input");

        const eyeOff = toggle.querySelector("[data-lucide='eye-off']");

        const eyeOn = toggle.querySelector("[data-lucide='eye']");

        if(input.type==="password"){

            input.type="text";

            eyeOff.style.display="none";

            eyeOn.style.display="block";

        }

        else{

            input.type="password";

            eyeOff.style.display="block";

            eyeOn.style.display="none";

        }

    });

});

const passwordInput = document.getElementById("password");
const strengthText = document.getElementById("strength");

passwordInput.addEventListener("input", () => {

    const password = passwordInput.value;

    let score = 0;

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    switch (score) {

        case 0:
        case 1:
            strengthText.textContent = "Very Weak";
            strengthText.style.color = "#ff4d4f";
            break;

        case 2:
            strengthText.textContent = "Weak";
            strengthText.style.color = "#ff8c42";
            break;

        case 3:
            strengthText.textContent = "Medium";
            strengthText.style.color = "#ffd43b";
            break;

        case 4:
            strengthText.textContent = "Strong";
            strengthText.style.color = "#40c057";
            break;

        case 5:
            strengthText.textContent = "Very Strong";
            strengthText.style.color = "#12b886";
            break;
    }

});