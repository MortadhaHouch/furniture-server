import fs from 'fs';
import {Router,Request,Response} from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import User from "../models/User"
import Product from "../models/Product"
import Card from "../models/Card";
import Category from "../models/Category";
import { FileArray } from "express-fileupload"
import path from "path";
import {v4} from "uuid"
import { getContentType } from '../utils/getFileType';
import { isValidObjectId, ObjectId } from 'mongoose';
import fsExtra from 'fs-extra';
const productController = Router();
productController.get("/stats",async(req:Request,res:Response)=>{
	try {
		const token = req.cookies.auth_token;
		console.log(req.url);
		if(token){
			const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
			console.log(email);
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({message:"Unauthorized"})
			}else{
				if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
					const startOfDay = new Date().setHours(0, 0, 0, 0);
					const endOfDay = new Date().setHours(23, 59, 59, 999);
					const salesToday = await Card.countDocuments({
						"products.addedOn":{
							$gte:startOfDay,
							$lte:endOfDay
						},
						"products.status":"COMPLETED"
					});
					const salesCount = await Card.countDocuments({
						"products.status":"COMPLETED"
					});
					const cancelledSalesThisMonth = await Card.countDocuments({
						"products.status":"CANCELLED",
						"products.addedOn":{
							$gte:startOfDay,
							$lte:endOfDay
						},
					});
					const cancelledSalesLastMonth = await Card.countDocuments({
						"products.status":"CANCELLED",
						"products.addedOn":{
							$gte:startOfDay,
							$lte:endOfDay
						},
					})
					const cancelPercent = ((cancelledSalesLastMonth - cancelledSalesThisMonth)/salesCount)*100
					const salesYesterday = (await Card.find({
						"products.addedOn":{
							$gte:startOfDay,
							$lte:endOfDay
						},
						"products.status":"COMPLETED"
					}).select({products:1})).map((item)=>item.products.length).reduce((acc,v)=>{return acc+=v},0);
					const ongoingOrders = (await Card.find({
						"products.status":"PENDING"
					}).select({products:1})).map((item)=>item.products.length).reduce((acc,v)=>{return acc+=v},0);
					const cancelledOrders = (await Card.find({
						"products.status":"CANCELLED"
					}).select({products:1})).map((item)=>item.products.length).reduce((acc,v)=>{return acc+=v},0);

					const salesPerMonth = await Card.aggregate([
						{
							$match: { "products.status": {
								$ne:"CANCELLED"
							} },
						},
						{
							$group: {
								_id: { $month: "$createdAt" },
								labels: { $sum: 1 },
								month: { $first: "$createdAt" },
							},
						},
						{ $sort: { date: 1 } },
					]);
					const userPerMonth = await User.aggregate([
						{
							$match: { role: "USER" },
						},
						{
							$group: {
								_id: { $month: "$createdAt" },
								labels: { $sum: 1 },
								month: { $first: "$createdAt" },
							},
						},
						{ $sort: { date: 1 } },
					]);
					res.json({
						isVerified:true,
						salesToday,
						salesYesterday,
						orders:ongoingOrders,
						cancelled:cancelledOrders,
						users:userPerMonth.map((item)=>{return {date:new Date(item.month).toDateString(),labels:item.labels}}),
						monthlySales:salesPerMonth.map((item)=>{return {date:new Date(item.month).toDateString(),labels:item.labels}}),
						cancelPercent
					})
				}else{
					res.status(401).json({auth_message:"Unauthorized"})
				}
			}
		}else{
			res.status(401).json({auth_message:"Unauthorized"})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.get("/trend",async(req:Request,res:Response)=>{
	try {
		const token = req.cookies.auth_token;
		const products = await Product.find().sort({sold:-1}).limit(10);
		const productMapped = products.map((item)=>{
			return{
				name:item.name,
				price:item.price,
				description:item.description,
				category:item.category,
				images:item.images,
				quantity:item.quantity,
				sold:item.sold,
				reviews:item.reviews,
				reviewers:item.reviewers,
				id:item._id,
				createdAt:item.createdAt,
				saves:item.saves,
			}
		});
		if(token){
			const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.json({
					ok:true,
					products:productMapped
				})
			}else{
				res.json({
					ok:true,
					isVerified:true,
					products:productMapped.map((p)=>{
						return {
							...p,
							isLiked:p.reviewers.some((r)=>{
								return r.toString() === user._id.toString()
							}),
							isSaved:user.savedProducts.map((p)=>p._id.toString()).includes(p.id.toString())
						}
					})
				})
			}
		}else{
			res.status(401).json({
				ok:true,
				products:productMapped
			})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.get("/latest",async(req:Request,res:Response)=>{
	try {
		const products = await Product.find().sort({createdAt:-1}).limit(10);
		const productMapped = products.map((item)=>{
			return{
				name:item.name,
				price:item.price,
				description:item.description,
				category:item.category,
				images:item.images,
				quantity:item.quantity,
				sold:item.sold,
				reviews:item.reviews,
				reviewers:item.reviewers,
				id:item._id,
				createdAt:item.createdAt,
				saves:item.saves,
			}
		});
		res.json({
			products:productMapped,
			ok:true
		})
	} catch (error) {
		console.log(error);
	}
})
productController.get("/:p?", async (req, res):Promise<any> => {
	try {
		const auth_token = req.cookies.auth_token;
		if (auth_token) {
			try {
				const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
				const user = await User.findOne({ email }).populate("savedProducts");
				if(user){
					const { p } = req.params;
					const category = req.query.category as string;
					const query = category ? { category } : {};
					const skip = p && !isNaN(Number(p)) ? (Number(p) - 1) * 10 : 0;
					const limit = 10;
					const categories = await Category.find().select({name:1,_id:1});
					const products = await Product.find(query)
						.sort({ createdAt: -1 })
						.skip(skip)
						.limit(limit);
						const formatProducts = []
					for(const item of products) {
						const reviews = []
						for await (const element of item.reviews) {
							const reviewer = await User.findById(element.userId);
							reviews.push({
								comment:element.comment,
								createdAt:element.createdAt,
								user:reviewer? {
									firstName: reviewer.firstName,
									lastName: reviewer.lastName,
									avatar: reviewer.avatar
								}:{}
							})
						}
						formatProducts.push({
							name: item.name,
							price: item.price,
							description: item.description,
							category: item.category,
							images: item.images,
							quantity: item.quantity,
							sold: item.sold,
							reviewers: item.reviewers,
							reviews,
							id: item._id,
							createdAt: item.createdAt,
							saves: item.saves
						})
					}
					return res.json({
						ok: true,
						isVerified: !!user,
						products:formatProducts,
						categories:categories.map((c)=>{return {
							name:c.name,
							id:c._id
						}})
					});
				}
			} catch (error) {
				console.error("JWT Verification Error:", error);
				return res.status(401).json({ ok: false, message: "Invalid Token" });
			}
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ ok: false, message: "Internal Server Error" });
	}
});
productController.get("/latest-sales/:p?", async (req: Request, res: Response): Promise<any> => {
	try {
	  const auth_token = req.cookies.auth_token;
	  if (!auth_token) {
		return res.status(401).json({ auth_message: "Unauthorized" });
	  }
  
	  const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
	  const user = await User.findOne({ email });
	  if (!user) {
		return res.status(401).json({ auth_message: "Unauthorized" });
	  }
  
	  if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
		const { p } = req.params;
		const page = p && !isNaN(Number(p)) ? Number(p) : 1;
		const limit = 10;
		const totalDocuments = await Card.countDocuments();
		const pagesCount = Math.ceil(totalDocuments / limit);
  
		const latestSales = await Card.find()
		  .sort({ createdAt: -1 })
		  .skip((page - 1) * limit)
		  .limit(limit)
		  .populate("user", "firstName lastName")
		  .populate("products.id");
  
		const salesFormatted = latestSales.map((card) => {
		  const productMap = new Map<string, any>();
  
		  card.products.forEach((product) => {
			const foundProduct = product.id as any;
			const productName = foundProduct?.name || "Produit inconnu";
  
			if (!productMap.has(productName)) {
			  productMap.set(productName, {
				id: foundProduct._id.toString(),
				user: {
				  id: card.user._id.toString(),
				  firstName: (card.user as any).firstName,
				  lastName: (card.user as any).lastName,
				},
				name: productName,
				price: foundProduct?.price || 0,
				images: foundProduct?.images || [],
				createdAt: card.createdAt,
				count: product.count,
				status: product.status,
				category: foundProduct.category,
			  });
			} else {
			  const existingProduct = productMap.get(productName);
			  existingProduct.count += product.count;
			  existingProduct.images = [...new Set([...existingProduct.images, ...foundProduct?.images || []])];
			  productMap.set(productName, existingProduct);
			}
		  });
  
		  return Array.from(productMap.values());
		}).flat();
  
		res.json({ isVerified: true, sales: salesFormatted, pagesCount, page });
	  } else {
		let myCard = await Card.findOne({user:user._id});
		const { p } = req.params;
		const page = p && !isNaN(Number(p)) ? Number(p) : 1;
		if(myCard){
			const limit = 10;
			const totalDocuments = myCard.products.length;
			const pagesCount = Math.ceil(totalDocuments / limit);
			const salesSearchTasks:Promise<any>[] = [];
			myCard.products.slice((page - 1) * limit, page * limit).forEach((product) => {
			  salesSearchTasks.push(
				Product.findById(product.id)
			  )
			})
			const sales = await Promise.all(salesSearchTasks);
			const salesFormatted = sales.filter((card) => card !== null).map((card) => {
				const currentProductIdx = myCard.products.findIndex((product) => product.id.toString() === card?._id.toString());
				if(currentProductIdx!==-1){
					return {
						id: card?._id.toString(),
						user: {
						  id: user._id.toString(),
						  firstName: user.firstName,
						  lastName: user.lastName,
						},
						name: card.name,
						price: card.price,
						createdAt: myCard.products[currentProductIdx].addedOn,
						count: myCard.products[currentProductIdx].count,
						status: myCard.products[currentProductIdx].status,
						category:card.category,
						images: card.images || [],
					  };
				}
			});
			res.json({ isVerified: true, page,sales:salesFormatted,pages:pagesCount });
		}else{
			res.status(200).json({
				isVerified: true,
				page,
				sales: []
			})
		}
	  }
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: "Internal Server Error" });
	}
});
interface ProductDetails {
    _id: string;
    name: string;
    price: number;
    category: string;
    images?: string[]; // Optional images field
}

interface PurchaserDetails {
    firstName: string;
    lastName: string;
    id: string;
}

interface Order {
    id: string;
    name: string;
    price: number;
    category: string;
    status: string;
    count: number;
    createdAt: Date;
    user: PurchaserDetails;
    images?: string[];
}
productController.get("/:status/:p?", async (req: Request, res: Response): Promise<any> => {
    try {
        const auth_token = req.cookies.auth_token;
        if (!auth_token) {
            return res.status(401).json({ auth_message: "Unauthorized" });
        }
        let decodedToken: { email: string };
        try {
            decodedToken = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
        } catch (error) {
            return res.status(401).json({ auth_message: "Invalid token" });
        }
        const { email } = decodedToken;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ auth_message: "Unauthorized" });
        }else{
			const { status, p } = req.params;
			console.log(status);
			const page = p && !isNaN(Number(p)) ? Number(p) : 1;
			const limit = 10;
			if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
				const totalDocuments = await Card.countDocuments({
					"products.status": status,
				});
				const pagesCount = Math.ceil(totalDocuments / limit);
				const latestSales = await Card.find({
					"products.status": status
				})
					.sort({ createdAt: -1 })
					.skip((page - 1) * limit)
					.limit(limit)
					.populate("user", "firstName lastName _id")
					.populate("products.id", "name price category images");
				const formattedSales: Order[] = latestSales.flatMap((sale) => {
					const purchaser = sale.user as unknown as PurchaserDetails;
					return sale.products.map((product) => {
						const productDetails = product.id as unknown as ProductDetails;
						return {
							id: productDetails._id,
							name: productDetails.name,
							price: productDetails.price,
							category: productDetails.category,
							status: product.status,
							count: product.count || 1,
							createdAt: sale.createdAt,
							user: {
								firstName: purchaser.firstName,
								lastName: purchaser.lastName,
								id: purchaser.id,
							},
							images: productDetails.images || [],
						};
					});
				});
				res.json({
					isVerified: true,
					pagesCount,
					page,
					sales: formattedSales,
				});
			}else{
				let userCard = await Card.findOne({user:user._id});
				if(!userCard){
					userCard = await Card.create({user:user._id});
					user.card = userCard._id;
					await user.save();
					res.status(200).json({
						isVerified: true,
						page,
						sales: []
					})
				}else{
                    const latestSalesSearchTask:any[] = [];
					userCard.products.filter((product) => product.status.toUpperCase() === status.toUpperCase()).forEach((product) => {
						latestSalesSearchTask.push(
							Product.findById(product.id)
						);
					})
					const latestSales = await Promise.all(latestSalesSearchTask);
					const formattedSales = latestSales.filter((p) => p !== null).map((product) => {
						const currentProduct = userCard?.products.find((p) => p.id.toString() === product?._id.toString()) as unknown as Order;
						if(currentProduct){
							console.log(product.images);
							return {
								id: currentProduct.id.toString(),
								name: product.name as string,
								price: product.price as string,
								category: product.category as string,
								status: currentProduct.status,
								count: currentProduct.count,
								createdAt: product.addedOn,
								user: {
									firstName: user.firstName,
									lastName: user.lastName,
									id: user._id.toString(),
								},
								images: product.images || [],
							};
						}
					});
					res.json({
						isVerified: true,
						page,
						sales: formattedSales
					})
				}
			}
		}
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
productController.post("/validate/:cardId/:id", async (req: Request, res: Response):Promise<any> => {
	try {
		const auth_token = req.cookies.auth_token;
		if (!auth_token) {
			return res.status(401).json({ auth_message: "Unauthorized" });
		}else{
			const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
			const user = await User.findOne({ email });
			if (!user) {
				return res.status(401).json({ auth_message: "Unauthorized" });
			}else{
				if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
					return res.status(401).json({ auth_message: "Unauthorized" });
				}else{
					const { cardId, id } = req.params;
					if (!isValidObjectId(cardId)) {
						return res.status(400).json({ error_message: "Invalid Card ID" });
					}else{
						if (!isValidObjectId(id)) {
							return res.status(400).json({ error_message: "Invalid Product ID" });
						}else{
							const card = await Card.findOne({user:cardId});
							if (!card) {
								return res.status(404).json({ message: "Card not found" });
							}else{
								const product = await Product.findById(id);
								if (!product) {
									return res.status(404).json({ not_found_message: "Product not found" });
								}else{
									const productIndex = card.products.findIndex((p) => p.id.toString() === id.toString());
									if (productIndex === -1) {
										return res.status(404).json({ not_found_message: "Product not found in the card" });
									}else{
										console.log(productIndex);
										card.products[productIndex].status = "COMPLETED";
										await card.save();
										return res.json({ success_message: "Product validated", isVerified: true });
									}
								}
							}
						}
					}
				}
			}
		}
	} catch (error) {
		console.error("Error in validate route:", error);
		return res.status(500).json({ error_message: "Internal Server Error" });
	}
});

productController.get("/image/:category/:name/:file_path", async (req: Request, res: Response) => {
	try {
		const { file_path,category,name } = req.params;
		console.log(file_path);
		const filePath = path.join(__dirname, "../uploads/categories",category,name, file_path);
		if (!fs.existsSync(filePath)) {
			res.status(404).json({ message: "File not found" });
		}else{
			res.setHeader("Content-Type", getContentType(file_path));
			res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
			res.sendFile(filePath);
		}
	} catch (error) {
		console.error("Error serving file:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});
productController.get("/order/:id",async(req:Request,res:Response)=>{
	try {
		const token = req.cookies.auth_token;
		if(token){
			const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
			console.log(email);
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({message:"Unauthorized"})
			}else{
				if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
					const {id} = req.params;
					if(isValidObjectId(id)){
						const card = await Card.findById(id);
						if(card){
							const products = await Promise.all(card.products.map(async(product)=>{
								const foundProduct = await Product.findById(product.id);
								if(foundProduct){
									return{
										id:foundProduct._id,
										name:foundProduct.name,
										quantity:product.count,
										price:foundProduct.price,
										description:foundProduct.description,
										category:foundProduct.category,
										images:foundProduct.images,
										createdAt:foundProduct.createdAt,
										updatedAt:foundProduct.updatedAt,
									}
								}else{
									return null;
								}
							}));
							res.json({isVerified:true,products});
						}else{
							res.status(404).json({message:"Card not found"})
						}
					}
				}else{
					res.status(401).json({auth_message:"Unauthorized"})
				}
			}
		}else{
			res.status(401).json({auth_message:"Unauthorized"})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.post("/add",async(req:Request,res:Response)=>{
	try{
		const token = req.cookies.auth_token;
		if(token){
			const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({message:"Unauthorized"})
			}else{
				if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
					const {name,description,price,quantity,category} = req.body  as {name:string,price:number,description:string,category:string,quantity:number};
					if(!name || !price || !description || !category|| !quantity){
						res.status(400).json({keys_message:"Please provide all required fields"})
					}
					const foundCategory = await Category.findOne({name:category});
					if(foundCategory){
						let files: FileArray | undefined = req.files ?? undefined;
						const product = new Product({name,price,description,category,quantity})
						if (files) {
							const uploadDir = path.join(__dirname, "../uploads/categories/", foundCategory.name, product.name);
							fs.mkdirSync(uploadDir, { recursive: true });
							const [fileArray]= Array.isArray(files) ? Array.from(files) : Object.values(files);
							console.log(fileArray);
							for (const file of fileArray) {
								try {
									const filename = v4() + path.extname(file.name);
									const filePath = path.join(uploadDir, filename);
									await new Promise<void>((resolve, reject) => {
										file.mv(filePath, (err: Error) => {
											if (err) {
												console.error("File upload error:", err);
												reject(err);
											} else {
												resolve();
											}
										});
									});
									if (fs.existsSync(filePath)) {
										product.images.push(filename);
									}
								} catch (err) {
									console.error("Error in file upload:", err);
								}
							}
						}
						await product.save();
						foundCategory.products.push(product._id);
						await foundCategory.save();
						res.status(201).json({
							success_message: "Product added successfully",
							product: {
								id: product._id.toString(),
								name: product.name,
								images: product.images,
								category: product.category,
								description: product.description,
								price: product.price,
								quantity: product.quantity,
								sold: product.sold,
							},
						});
					}else{
						res.status(404).json({message:"Category not found"})
					}
				}else{
					res.status(401).json({auth_message:"Unauthorized"})
				}
			}
		}else{
			res.status(401).json({cred_message:"Unauthorized"})
		}
	}catch(e){
		console.log(e);
	}
})
productController.post("/cart/add/:id", async (req: Request, res: Response):Promise<any> => {
	try {
		const auth_token = req.cookies.auth_token;
		if (!auth_token) {
			return res.status(401).json({ message: "Unauthorized" });
		}else{
			const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
			const user = await User.findOne({ email });
			if (!user) {
				return res.status(401).json({ message: "Unauthorized" });
			}else{
				const { id } = req.params as { id: string };
				const product = await Product.findById(id);
				if (!product) {
					return res.status(404).json({ message: "Product not found" });
				}else{
					if(user.role === "USER"){
						let userCard = await Card.findById(user.card);
						if (!userCard) {
							userCard = await Card.create({ user: user._id, products: [{
								id: product._id,
								count: 1,
								}] });
							user.card = userCard._id;
							await user.save();
							return res.status(201).json({ isVerified: true, message: "Product added to cart successfully" });
						}else{
							const isExisting = userCard.products.some((item) => item.id.toString() === product._id.toString());
							if (isExisting) {
								return res.status(400).json({ message: "Product already exists in cart" });
							}else{
								userCard.products.push({
									id: product._id,
									count: 1,
								});
								await userCard.save();
								return res.status(201).json({ isVerified: true, message: "Product added to cart successfully" });
							}
						}
					}else{
						return res.status(401).json({ message: "Unauthorized" });
					}
				}
			}
		}
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

productController.get("/by-id/:id",async(req:Request,res:Response)=>{
	try {
		const {id} = req.params
		const product = await Product.findById(id);
		if(product){
			const foundProduct = {
				name:product.name as string,
				price:product.price as number,
				description:product.description as string,
				category:product.category as string,
				images:product.images as string[],
				quantity:product.quantity as number,
				sold:product.sold as number,
			}
			res.json({product:foundProduct})
		}else{
			res.status(404).json({message:"Product not found"})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.put("/update/:id", async (req: Request, res: Response) => {
	try {
		const token = req.cookies.auth_token;
		if (token) {
			const { email } = jwt.verify(token, process.env.SECRET_KEY as string) as { email: string };
			const user = await User.findOne({ email });
			if (!user) {
				res.status(401).json({ message: "Unauthorized" });
			} else {
				if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
					const { id } = req.params;
					const { description, price, quantity, images } = req.body as { images: string[], price: number, description: string, quantity: number };
					if (!price || !description || !quantity) {
						res.status(400).json({ keys_message: "Please provide all required fields" });
						return;
					}
					const foundProduct = await Product.findById(id);
					if (foundProduct) {
						foundProduct.description = description;
						foundProduct.price = price;
						foundProduct.quantity = quantity;
						const files = req.files ?? undefined;
						const uploadDir = path.join(__dirname, "../uploads/categories/", foundProduct.category, foundProduct.name);
						if (files) {
							const [fileArray] = Array.isArray(files) ? Array.from(files) : Object.values(files);
							for (const file of fileArray) {
								try {
									const filename = v4() + path.extname(file.name);
									const filePath = path.join(uploadDir, filename);
									await fsExtra.move(file.path, filePath);
									if (fs.existsSync(filePath)) {
										foundProduct.images.push(filename);
									}
								} catch (err) {
									console.error("Error in file upload:", err);
								}
							}
						}
						for await (const image of images) {
							const imagePath = path.join(uploadDir, image);
							if (fs.existsSync(imagePath)) {
								try {
									await fs.promises.unlink(imagePath);
									foundProduct.images = foundProduct.images.filter((img: string) => img !== image);
								} catch (err) {
									console.error("Error deleting file:", err);
								}
							}
						}
						await foundProduct.save();
						res.json({ message: "Product updated successfully" });
					} else {
						res.status(404).json({ message: "Product not found" });
					}
				} else {
					res.status(401).json({ auth_message: "Unauthorized" });
				}
			}
		} else {
			res.status(401).json({ auth_message: "Unauthorized" });
		}
	} catch (e) {
		console.log(e);
		res.status(500).json({ message: "Internal server error" });
	}
});
productController.post("/save/:id",async(req:Request,res:Response)=>{
	try {
		const auth_token = req.cookies.auth_token;
		if(auth_token){
			const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({auth_message:"Unauthorized"})
			}else{
				const {id} = req.params;
				if(isValidObjectId(id)){
					const product = await Product.findById(id);
					if(!product){
						res.status(404).json({not_found_message:"Product not found"})
					}else{
						if(user.savedProducts.includes(product._id)){
							user.savedProducts = user.savedProducts.filter((p)=>p.toString() !== product._id.toString());
							product.saves-=1;
							await product.save();
							await user.save();
							res.json({
								message:"Product already saved",
								saves:product.saves,
								isVerified:true
							})
						}else{
							user.savedProducts.push(product._id);
							product.saves+=1;
							await product.save();
							await user.save();
							res.json({
								message:"Product saved",
								saves:product.saves,
								isVerified:true
							})
						}
					}
				}else{
					res.status(404).json({not_found_message:"Product not found"})
				}
			}
		}else{
		res.status(401).json({auth_message:"Unauthorized"})
	}
	} catch (error) {
		console.log(error);
	}
})
productController.post("/like/:id",async(req:Request,res:Response)=>{
	try {
		const auth_token = req.cookies.auth_token;
		if(auth_token){
			const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({auth_message:"Unauthorized"})
			}else{
				const {id} = req.params;
				if(isValidObjectId(id)){
					const product = await Product.findById(id);
					if(!product){
						res.status(404).json({message:"Product not found"})
					}else{
						const isLiked = product.reviewers.some(reviewer => {
							return reviewer.userId && isValidObjectId(reviewer.userId) && reviewer.userId.toString() === user._id.toString()
						});
						if(isLiked){
							const index = product.reviewers.findIndex(reviewer => {
								return reviewer.userId && isValidObjectId(reviewer.userId) && reviewer.userId.toString() === user._id.toString()
							});
							product.reviewers.splice(index,1);
						}else{
							product.reviewers.push({userId:user._id})
						}
						await product.save();
						res.json({reviewers:product.reviewers,isVerified:true})
					}
				}else{
					res.status(404).json({message:"Product not found"})
				}
			}
		}else{
			res.status(401).json({auth_message:"Unauthorized"})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.post("/cancel/:productId",async(req:Request,res:Response)=>{
	try {
		const auth_token = req.cookies.auth_token;
		if(auth_token){
			const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({auth_message:"Unauthorized"})
			}else{
				const {productId} = req.params;
				if(isValidObjectId(productId)){
					const userCard = await Card.findOne({user:user._id});
					if(!userCard){
						res.status(404).json({message:"Cart not found"})
					}else{
						const product = await Product.findById(productId);
						if(!product){
							res.status(404).json({message:"Product not found"})
						}else{
							const isPurchased = userCard.products.findIndex(p=>p.id.toString() === product._id.toString() && p.status !== "CANCELLED");
							if(isPurchased!==-1){
								userCard.products[isPurchased].status = "CANCELLED";
								await userCard.save();
								res.json({ success_message: "Product cancelled", isVerified: true });
							}else{
								res.status(404).json({message:"Product not found"})
							}
						}
					}
				}else{
					res.status(404).json({message:"Product not found"})
				}
			}
		}else{
			res.status(401).json({auth_message:"Unauthorized"})
		}
	} catch (error) {
		console.log(error);
	}
})
productController.post("/review/:id",async(req:Request,res:Response)=>{
	try {
		const auth_token = req.cookies.auth_token;
		if(auth_token){
			const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({auth_message:"Unauthorized"})
			}else{
				const {id} = req.params;
				if(isValidObjectId(id)){
					const product = await Product.findById(id);
					if(!product){
						res.status(404).json({message:"Product not found"})
					}else{
						const {comment} = req.body;
						if(comment){
							product.reviews.push({userId:user._id,comment});
							await product.save();
							res.json({comment:{
								comment,
								user:{
									firstName:user.firstName,
									lastName:user.lastName,
									userId:user._id,
								},
								createdAt:new Date().toLocaleDateString()
							},isVerified:true})
						}else{
							res.status(400).json({message:"Rating and review are required"})
						}
					}
				}else{
					res.status(404).json({message:"Product not found"})
				}
			}
		}
	}catch(e){
		console.log(e);
	}
})
productController.delete("/:id",async(req:Request,res:Response)=>{
	try {
		const token = req.cookies.auth_token;
		if(token){
			const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
			const user = await User.findOne({email});
			if(!user){
				res.status(401).json({auth_error:"Unauthorized"})
			}else{
				if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
					const {id} = req.params;
					const product = await Product.findById(id);
					if(product){
						const category = await Category.findOne({name:product.category})
						if(category){
							category.products.splice(category.products.indexOf(category._id),1);
							await category.save();
						}
						const productPath = path.join(__dirname, "../uploads/categories/", product.category, product.name);
						if (fs.existsSync(productPath)) {
							try {
								await fs.promises.rm(productPath, { recursive: true, force: true });
								await product.deleteOne();
							} catch (err) {
								console.error("Error deleting file:", err);
							}
						}
						await product.deleteOne();
						res.json({success_message:"Product deleted"})
					}else{
						res.json({success_message:"Product not found"})
					}
				}else{
					res.status(401).json({auth_message:"Unauthorized"})
				}
			}
		}
	} catch (error) {
		console.log(error);
	}
})
export default productController;