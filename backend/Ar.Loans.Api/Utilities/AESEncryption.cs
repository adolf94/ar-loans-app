using System.Security.Cryptography;
using System.Text;

namespace Ar.Loans.Api.Utilities
{
		public class AesOperation
		{

				public static string EncryptString(string password, string secret)
				{
						byte[] salt = new byte[16];
						using (var rng = RandomNumberGenerator.Create())
						{
								rng.GetBytes(salt);
						}
						using (Rfc2898DeriveBytes kdf = new Rfc2898DeriveBytes(password, salt, 100000, HashAlgorithmName.SHA256))
						{
								byte[] key = kdf.GetBytes(32);
								using (var aes = Aes.Create())
								{
										aes.Key = key;
										aes.GenerateIV();
										using (var encryptor = aes.CreateEncryptor())
										{
												byte[] encrypted;
												using (var ms = new System.IO.MemoryStream())
												{
														using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
														{
																using (var sw = new System.IO.StreamWriter(cs))
																{
																		sw.Write(secret);
																}
																encrypted = ms.ToArray();
														}
												}
												byte[] iv = aes.IV;
												byte[] result = new byte[salt.Length + iv.Length + encrypted.Length];
												Buffer.BlockCopy(salt, 0, result, 0, salt.Length);
												Buffer.BlockCopy(iv, 0, result, salt.Length, iv.Length);
												Buffer.BlockCopy(encrypted, 0, result, salt.Length + iv.Length, encrypted.Length);
												return Convert.ToBase64String(result);
										}
								}
						}
				}

				public static string DecryptString(string password, string encrypted)
				{
						try
						{
								byte[] encryptedBytes = Convert.FromBase64String(encrypted);
								byte[] pwBytes = Encoding.UTF8.GetBytes(password);
								byte[] salt = new byte[16];
								byte[] iv = new byte[16];
								byte[] encryptedSecret = new byte[encryptedBytes.Length - salt.Length - iv.Length];
								Buffer.BlockCopy(encryptedBytes, 0, salt, 0, salt.Length);
								Buffer.BlockCopy(encryptedBytes, salt.Length, iv, 0, iv.Length);
								Buffer.BlockCopy(encryptedBytes, salt.Length + iv.Length, encryptedSecret, 0, encryptedSecret.Length);
								using (var kdf = new Rfc2898DeriveBytes(password, salt, 100000, HashAlgorithmName.SHA256))
								{
										byte[] key = kdf.GetBytes(32);
										using (var aes = Aes.Create())
										{
												aes.Key = key;
												aes.IV = iv;
												using (var decryptor = aes.CreateDecryptor())
												{
														using (var ms = new System.IO.MemoryStream(encryptedSecret))
														{
																using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
																{
																		using (var sr = new System.IO.StreamReader(cs))
																		{
																				return sr.ReadToEnd();
																		}
																}
														}
												}
										}
								}
						}
						catch (Exception ex)
						{

								Console.WriteLine("Error decrypting " + encrypted, ex);
								throw;
						}


				}



		}
}