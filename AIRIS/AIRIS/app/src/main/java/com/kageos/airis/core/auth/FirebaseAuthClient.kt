package com.kageos.airis.core.auth

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.tasks.await

object FirebaseAuthClient {

    private val auth: FirebaseAuth = FirebaseAuth.getInstance()

    val currentUser: FirebaseUser?
        get() = auth.currentUser

    val isSignedIn: Boolean
        get() = auth.currentUser != null

    suspend fun signInWithEmail(email: String, password: String): Result<FirebaseUser> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            val user = result.user
            if (user != null) {
                Result.success(user)
            } else {
                Result.failure(Exception("Sign in failed: no user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUpWithEmail(email: String, password: String): Result<FirebaseUser> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            val user = result.user
            if (user != null) {
                Result.success(user)
            } else {
                Result.failure(Exception("Sign up failed: no user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getIdToken(): Result<String> {
        return try {
            val user = auth.currentUser
                ?: return Result.failure(Exception("Not signed in"))
            val token = user.getIdToken(false).await()
            val tokenString = token.token
            if (tokenString != null) {
                Result.success(tokenString)
            } else {
                Result.failure(Exception("Failed to get token"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun signOut() {
        auth.signOut()
    }

    fun getUid(): String? = auth.currentUser?.uid
    fun getEmail(): String? = auth.currentUser?.email
}
