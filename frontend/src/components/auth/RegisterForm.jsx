import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";


function RegisterForm() {


  const navigate = useNavigate();


  const [showPassword, setShowPassword] = useState(false);


  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");





  const handleSubmit = (e) => {


    e.preventDefault();




    // Name validation

    const nameRule = /^[A-Za-z ]{3,30}$/;





    // Email validation

    const emailRule =
      /^[a-zA-Z0-9]+([._-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;






    // Password validation

    const passwordRule =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&*!_\-+=])[A-Za-z\d@#$%^&*!_\-+=]{8,}$/;







    if (!nameRule.test(name)) {


      alert(
        "Name should contain only letters and minimum 3 characters"
      );


      return;


    }






    if (!emailRule.test(email)) {


      alert("Please enter a valid email address");


      return;


    }







    if (!passwordRule.test(password)) {


      alert(
        "Password must contain:\n\n" +
        "✔ Minimum 8 characters\n" +
        "✔ One uppercase letter\n" +
        "✔ One lowercase letter\n" +
        "✔ One number\n" +
        "✔ One special character\n" +
        "✔ No spaces"
      );


      return;


    }







    if (password !== confirmPassword) {


      alert("Passwords do not match");


      return;


    }







    // Get existing registered users

    const users = JSON.parse(
      localStorage.getItem("users")
    ) || [];






    // Check if account already exists

    const existingUser = users.find(
      (user) => user.email === email
    );






    if (existingUser) {


      alert(
        "Account already exists. Please login."
      );


      return;


    }







    // Save new user

    const newUser = {


      name:name,

      email:email,

      password:password


    };






    users.push(newUser);






    localStorage.setItem(

      "users",

      JSON.stringify(users)

    );






    alert(
      "Account created successfully. Please login."
    );






    // Go to login page

    navigate("/");



  };








  return (


    <div className="auth-card">





      <h1>
        Create Account
      </h1>





      <p className="subtitle">
        Join MarketMind AI
      </p>







      <form onSubmit={handleSubmit}>






        {/* Name */}


        <label>
          Name
        </label>



        <input


          type="text"


          placeholder="Enter your name"


          value={name}


          maxLength="30"


          onChange={(e)=>setName(e.target.value)}


          required


        />









        {/* Email */}



        <label>
          Email
        </label>




        <input


          type="email"


          placeholder="Enter your email"


          value={email}


          maxLength="50"


          onChange={(e)=>setEmail(e.target.value)}


          required


        />









        {/* Password */}



        <label>
          Password
        </label>





        <div className="password-field">



          <input


            type={showPassword ? "text" : "password"}


            placeholder="Create password"


            value={password}


            minLength="8"


            maxLength="20"


            onChange={(e)=>setPassword(e.target.value)}


            required


          />





          <button


            type="button"


            className="toggle-password"


            onClick={() =>
              setShowPassword(!showPassword)
            }


          >


            {showPassword ? "Hide" : "Show"}



          </button>



        </div>









        {/* Confirm Password */}




        <label>
          Confirm Password
        </label>





        <input


          type="password"


          placeholder="Confirm password"


          value={confirmPassword}


          onChange={(e)=>setConfirmPassword(e.target.value)}


          required


        />







        <button

          className="auth-btn"

          type="submit"

        >


          Register



        </button>







      </form>








      <p className="bottom-text">



        Already have an account?{" "}





        <Link to="/">


          Login


        </Link>




      </p>







    </div>



  );


}



export default RegisterForm;