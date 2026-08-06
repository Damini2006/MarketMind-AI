from fastapi import APIRouter, Depends, HTTPException, status

from pydantic import BaseModel, EmailStr

from sqlalchemy.orm import Session



from .. import models, schemas

from ..database import get_db

from ..core.security import (

    hash_password,

    verify_password,

    create_access_token,

)

from ..deps import get_current_user



router = APIRouter(

    prefix="/api/auth",

    tags=["Authentication"],

)





# --- Additional Schemas ---

class ProfileUpdateRequest(BaseModel):

    full_name: str

    email: EmailStr





class ChangePasswordRequest(BaseModel):

    current_password: str

    new_password: str





class ForgotPasswordRequest(BaseModel):

    email: EmailStr





@router.post(

    "/register",

    response_model=schemas.UserOut,

    status_code=status.HTTP_201_CREATED,

)

def register(

    payload: schemas.RegisterRequest,

    db: Session = Depends(get_db),

):

    existing = (

        db.query(models.User)

        .filter(models.User.email == payload.email)

        .first()

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Email address is already registered",

        )



    user = models.User(

        full_name=payload.name,

        email=payload.email,

        hashed_password=hash_password(payload.password),

        role=payload.role,

    )



    db.add(user)

    db.commit()

    db.refresh(user)



    return user





@router.post("/login", response_model=schemas.Token)

def login(

    payload: schemas.LoginRequest,

    db: Session = Depends(get_db),

):

    user = (

        db.query(models.User)

        .filter(models.User.email == payload.email)

        .first()

    )



    if not user or not verify_password(payload.password, user.hashed_password):

        raise HTTPException(

            status_code=401,

            detail="Incorrect email or password",

        )



    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)



    token = create_access_token(

        {

            "sub": str(user.id),

            "role": role_str,

        }

    )



    return {

        "access_token": token,

        "token_type": "bearer",

        "user": user,

    }





@router.get("/me", response_model=schemas.UserOut)

def me(

    current_user: models.User = Depends(get_current_user),

):

    return current_user





@router.put("/profile", response_model=schemas.UserOut)

def update_profile(

    payload: ProfileUpdateRequest,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(get_current_user),

):

    existing = (

        db.query(models.User)

        .filter(models.User.email == payload.email, models.User.id != current_user.id)

        .first()

    )

    if existing:

        raise HTTPException(

            status_code=400,

            detail="Email address is already in use",

        )



    current_user.full_name = payload.full_name

    current_user.email = payload.email



    db.commit()

    db.refresh(current_user)

    return current_user





@router.put("/change-password")

def change_password(

    payload: ChangePasswordRequest,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(get_current_user),

):

    if not verify_password(payload.current_password, current_user.hashed_password):

        raise HTTPException(

            status_code=400,

            detail="Incorrect current password",

        )



    current_user.hashed_password = hash_password(payload.new_password)

    db.commit()



    return {"message": "Password updated successfully"}





@router.post("/forgot-password")

def forgot_password(

    payload: ForgotPasswordRequest,

    db: Session = Depends(get_db),

):

    user = db.query(models.User).filter(models.User.email == payload.email).first()

    return {

        "message": "If an account with that email exists, a password reset link has been sent."

    } 

